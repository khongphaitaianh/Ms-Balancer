package proxy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/loseleaf/modelscope-balancer/keymanager"
)

// ChatProxy handles chat completion requests with load balancing and failover
type ChatProxy struct {
	keyManager *keymanager.KeyManager
	logger     *slog.Logger
	client     *http.Client
}

// NewChatProxy creates a new ChatProxy instance
func NewChatProxy(km *keymanager.KeyManager, logger *slog.Logger) *ChatProxy {
	return &ChatProxy{
		keyManager: km,
		logger:     logger,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ChatRequest represents the structure of a chat completion request
type ChatRequest struct {
	Stream bool `json:"stream"`
	// Other fields can be added as needed
}

// ServeHTTP implements the http.Handler interface for chat proxy
func (cp *ChatProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Get maximum retry count based on available keys
	maxRetries := len(cp.keyManager.ListKeys())
	if maxRetries == 0 {
		cp.logger.Error("No API keys available")
		http.Error(w, "Service temporarily unavailable", http.StatusServiceUnavailable)
		return
	}

	// Buffer the complete request body as we may need to send it multiple times
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		cp.logger.Error("Failed to read request body", "error", err)
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Parse request body JSON to check if stream is true
	var chatReq ChatRequest
	isStream := false
	if err := json.Unmarshal(bodyBytes, &chatReq); err == nil {
		isStream = chatReq.Stream
	}

	var lastError error

	// Retry loop with maximum attempts equal to number of available keys
	for attempt := 0; attempt < maxRetries; attempt++ {
		// Get next available API key
		apiKey := cp.keyManager.GetNextActiveKey()
		if apiKey == nil {
			cp.logger.Error("No active API keys available")
			break
		}

		cp.logger.Debug("Attempting request", "attempt", attempt+1, "key_value", apiKey.Value)

		// Create new request to upstream service
		proxyReq, err := http.NewRequest(r.Method, "https://api-inference.modelscope.cn/v1/chat/completions", bytes.NewReader(bodyBytes))
		if err != nil {
			lastError = err
			cp.logger.Error("Failed to create proxy request", "error", err)
			continue
		}

		// Copy original request headers
		for name, values := range r.Header {
			for _, value := range values {
				proxyReq.Header.Add(name, value)
			}
		}

		// Set authorization header with API key
		proxyReq.Header.Set("Authorization", "Bearer "+apiKey.Value)

		// Send request using HTTP client
		resp, err := cp.client.Do(proxyReq)
		if err != nil {
			// Network error occurred
			lastError = err
			reason := fmt.Sprintf("Network error: %v", err)
			cp.keyManager.DisableKey(apiKey.Value, reason)
			cp.logger.Warn("Request failed, disabling key", "key_value", apiKey.Value, "reason", reason)
			continue
		}

		// Check response status
		if resp.StatusCode != http.StatusOK {
			// Non-200 response, disable key
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			reason := fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(bodyBytes))
			lastError = fmt.Errorf("upstream returned %d", resp.StatusCode)
			cp.keyManager.DisableKey(apiKey.Value, reason)
			cp.logger.Warn("Request failed, disabling key", "key_value", apiKey.Value, "status", resp.StatusCode, "reason", reason)
			continue
		}

		// Success! Copy response headers and forward response body
		for name, values := range resp.Header {
			for _, value := range values {
				w.Header().Add(name, value)
			}
		}

		w.WriteHeader(resp.StatusCode)

		// Forward response body to client
		_, err = io.Copy(w, resp.Body)
		resp.Body.Close()

		if err != nil {
			cp.logger.Error("Failed to copy response body", "error", err)
		} else {
			cp.logger.Info("Request successful", "key_value", apiKey.Value, "stream", isStream)
		}

		return // Success, end function
	}

	// All retries failed, return 502 Bad Gateway
	cp.logger.Error("All retry attempts failed", "max_retries", maxRetries, "last_error", lastError)
	errorMsg := "All API keys failed"
	if lastError != nil {
		errorMsg = fmt.Sprintf("All API keys failed: %v", lastError)
	}
	http.Error(w, errorMsg, http.StatusBadGateway)
}

// HandleGetModels handles GET /v1/models requests with load balancing and failover
func (cp *ChatProxy) HandleGetModels(w http.ResponseWriter, r *http.Request) {
	// Get maximum retry count based on available keys
	maxRetries := len(cp.keyManager.ListKeys())
	if maxRetries == 0 {
		cp.logger.Error("No API keys available")
		http.Error(w, "Service temporarily unavailable", http.StatusServiceUnavailable)
		return
	}

	var lastError error

	// Retry loop with maximum attempts equal to number of available keys
	for attempt := 0; attempt < maxRetries; attempt++ {
		// Get next available API key
		apiKey := cp.keyManager.GetNextActiveKey()
		if apiKey == nil {
			cp.logger.Error("No active API keys available")
			break
		}

		cp.logger.Debug("Attempting models request", "attempt", attempt+1, "key_value", apiKey.Value)

		// Create new request to upstream service
		proxyReq, err := http.NewRequest("GET", "https://api-inference.modelscope.cn/v1/models", nil)
		if err != nil {
			lastError = err
			cp.logger.Error("Failed to create proxy request", "error", err)
			continue
		}

		// Copy original request headers (except Authorization)
		for name, values := range r.Header {
			if name != "Authorization" {
				for _, value := range values {
					proxyReq.Header.Add(name, value)
				}
			}
		}

		// Set authorization header with API key
		proxyReq.Header.Set("Authorization", "Bearer "+apiKey.Value)

		// Send request using HTTP client
		resp, err := cp.client.Do(proxyReq)
		if err != nil {
			// Network error occurred
			lastError = err
			reason := fmt.Sprintf("Network error: %v", err)
			cp.keyManager.DisableKey(apiKey.Value, reason)
			cp.logger.Warn("Models request failed, disabling key", "key_value", apiKey.Value, "reason", reason)
			continue
		}

		// Check response status
		if resp.StatusCode != http.StatusOK {
			// Non-200 response, disable key
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			reason := fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(bodyBytes))
			lastError = fmt.Errorf("upstream returned %d", resp.StatusCode)
			cp.keyManager.DisableKey(apiKey.Value, reason)
			cp.logger.Warn("Models request failed, disabling key", "key_value", apiKey.Value, "status", resp.StatusCode, "reason", reason)
			continue
		}

		// Success! Copy response headers and forward response body
		for name, values := range resp.Header {
			for _, value := range values {
				w.Header().Add(name, value)
			}
		}

		w.WriteHeader(resp.StatusCode)

		// Forward response body to client
		_, err = io.Copy(w, resp.Body)
		resp.Body.Close()

		if err != nil {
			cp.logger.Error("Failed to copy models response body", "error", err)
		} else {
			cp.logger.Info("Models request successful", "key_value", apiKey.Value)
		}

		return // Success, end function
	}

	// All retries failed, return 502 Bad Gateway
	cp.logger.Error("All models request retry attempts failed", "max_retries", maxRetries, "last_error", lastError)
	errorMsg := "All API keys failed"
	if lastError != nil {
		errorMsg = fmt.Sprintf("All API keys failed: %v", lastError)
	}
	http.Error(w, errorMsg, http.StatusBadGateway)
}
