package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/loseleaf/modelscope-balancer/config"
	"github.com/loseleaf/modelscope-balancer/keymanager"
	authmiddleware "github.com/loseleaf/modelscope-balancer/middleware"
	"github.com/loseleaf/modelscope-balancer/proxy"
	"github.com/loseleaf/modelscope-balancer/scheduler"
	"github.com/loseleaf/modelscope-balancer/webui"
)

//go:embed all:frontend/dist
var frontendFS embed.FS

// Global logger variable
var logger *slog.Logger

// init initializes the global logger with JSON format
func init() {
	// Create a JSON handler for structured logging
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	logger = slog.New(handler)

	// Set as default logger
	slog.SetDefault(logger)
}

func main() {
	// Load application configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	// Log configuration details (without exposing sensitive tokens)
	logger.Info("Configuration loaded successfully",
		"server_address", cfg.ServerAddress,
		"api_keys_count", len(cfg.ApiKeys),
		"auto_reactivation_enabled", cfg.AutoReactivation.Enabled,
		"auto_reactivation_mode", cfg.AutoReactivation.Mode,
		"auto_reactivation_interval", cfg.AutoReactivation.Interval,
		"admin_token_configured", cfg.AdminToken != "",
		"api_token_configured", cfg.ApiToken != "",
	)

	// Initialize key manager with API keys from configuration
	stateFilePath := "state.json"
	keyManager := keymanager.New(cfg.ApiKeys, stateFilePath, logger)

	// Load state from file if it exists
	if err := keyManager.LoadState(); err != nil {
		logger.Error("Failed to load state from state.json", "error", err)
		// For robustness, we continue running with initial configuration
	} else {
		logger.Info("Successfully loaded state from state.json")
	}

	// Log service startup information
	logger.Info("Starting ModelScope Balancer", "loaded_keys", len(cfg.ApiKeys), "active_keys", len(keyManager.ListKeys()))

	// Create ChatProxy instance
	chatProxy := proxy.NewChatProxy(keyManager, logger)

	// Initialize and start the task scheduler
	taskScheduler := scheduler.New(keyManager, logger)
	taskScheduler.Start(cfg.AutoReactivation)

	// Initialize dynamic authentication middlewares
	adminAuth := authmiddleware.NewDynamicAuthenticator(cfg.AdminToken)
	apiAuth := authmiddleware.NewDynamicAuthenticator(cfg.ApiToken)

	// Create AdminHandler instance
	adminHandler := webui.NewAdminHandler(keyManager, logger, cfg.AdminToken, taskScheduler, adminAuth, apiAuth)

	// Initialize chi router
	r := chi.NewRouter()

	// Add useful middlewares
	r.Use(middleware.RequestID) // Add unique request ID to each request
	r.Use(middleware.RealIP)    // Get real client IP
	r.Use(middleware.Logger)    // Request logging compatible with slog
	r.Use(middleware.Recoverer) // Panic recovery to prevent service crashes

	// Define health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		response := map[string]string{
			"status": "running",
		}
		json.NewEncoder(w).Encode(response)
	})

	// Mount v1 API routes with API token authentication
	r.Route("/v1", func(r chi.Router) {
		r.Use(apiAuth.Middleware()) // Apply API token authentication
		r.Get("/models", chatProxy.HandleGetModels)
		r.Post("/chat/completions", chatProxy.ServeHTTP)
	})

	// Mount admin API routes with admin token authentication
	r.Route("/admin/api", func(r chi.Router) {
		r.Use(adminAuth.Middleware()) // Apply admin token authentication
		r.Get("/keys", adminHandler.ListKeys)
		r.Post("/keys", adminHandler.AddKey)
		r.Delete("/keys", adminHandler.DeleteKey)
		r.Post("/keys/reactivate", adminHandler.ReactivateKey)
		r.Post("/keys/disable", adminHandler.DisableKey)
		r.Post("/keys/batch-add", adminHandler.BatchAddKeys)
		r.Get("/proxied-models", adminHandler.ProxiedGetModels)
		r.Get("/settings", adminHandler.GetSettings)
		r.Post("/settings", adminHandler.UpdateSettings)
	})

	// Special route for TestKeys that handles its own authentication (for EventSource compatibility)
	r.Get("/admin/api/keys/test", adminHandler.TestKeys)  // GET for EventSource
	r.Post("/admin/api/keys/test", adminHandler.TestKeys) // POST for regular requests

	// Serve static files from embedded frontend
	frontendSubFS, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		logger.Error("Failed to create frontend sub filesystem", "error", err)
	} else {
		fileServer := http.FileServer(http.FS(frontendSubFS))
		r.Handle("/*", fileServer)
	}

	// Log server listening address
	logger.Info("Server starting", "address", cfg.ServerAddress)

	// Start HTTP server
	if err := http.ListenAndServe(cfg.ServerAddress, r); err != nil {
		logger.Error("Server failed to start", "error", err)
		os.Exit(1)
	}
}
