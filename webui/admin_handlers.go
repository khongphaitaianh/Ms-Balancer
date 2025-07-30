package webui

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/loseleaf/modelscope-balancer/config"
	"github.com/loseleaf/modelscope-balancer/keymanager"
	"github.com/loseleaf/modelscope-balancer/scheduler"
)

// AdminHandler handles web admin API requests
type AdminHandler struct {
	km         *keymanager.KeyManager
	logger     *slog.Logger
	adminToken string
	scheduler  *scheduler.Scheduler
}

// Request structures for key operations
type KeyOperationRequest struct {
	Value string `json:"value"`
}

type DisableKeyRequest struct {
	Value  string `json:"value"`
	Reason string `json:"reason,omitempty"`
}

// NewAdminHandler creates a new AdminHandler instance
func NewAdminHandler(km *keymanager.KeyManager, logger *slog.Logger, adminToken string, scheduler *scheduler.Scheduler) *AdminHandler {
	return &AdminHandler{
		km:         km,
		logger:     logger,
		adminToken: adminToken,
		scheduler:  scheduler,
	}
}

// validateAdminToken validates the provided token against the configured admin token
func (ah *AdminHandler) validateAdminToken(token string) bool {
	return ah.adminToken != "" && token == ah.adminToken
}

// ListKeys handles GET /admin/api/keys requests
func (ah *AdminHandler) ListKeys(w http.ResponseWriter, r *http.Request) {
	// Get all keys from key manager
	keys := ah.km.ListKeys()

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	// Serialize keys to JSON and return
	if err := json.NewEncoder(w).Encode(keys); err != nil {
		ah.logger.Error("Failed to encode keys to JSON", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	ah.logger.Info("Listed all keys", "count", len(keys))
}

// AddKeyRequest represents the request body for adding a new key
type AddKeyRequest struct {
	Value string `json:"value"`
}

// AddKey handles POST /admin/api/keys requests
func (ah *AdminHandler) AddKey(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req AddKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		ah.logger.Warn("Failed to parse add key request", "error", err)
		http.Error(w, "Invalid JSON request body", http.StatusBadRequest)
		return
	}

	// Validate key value
	if req.Value == "" {
		ah.logger.Warn("Empty key value provided")
		http.Error(w, "Key value cannot be empty", http.StatusBadRequest)
		return
	}

	// Add new key to key manager
	newKey := ah.km.AddKey(req.Value)

	// Save state to file after successful addition
	if err := ah.km.SaveState(); err != nil {
		ah.logger.Error("Failed to save state after adding key", "error", err)
		http.Error(w, "Failed to save state", http.StatusInternalServerError)
		return
	}

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)

	// Return the newly created key
	if err := json.NewEncoder(w).Encode(newKey); err != nil {
		ah.logger.Error("Failed to encode new key to JSON", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	ah.logger.Info("Added new key", "key_value", newKey.Value)
}

// DeleteKey handles DELETE /admin/api/keys requests
func (ah *AdminHandler) DeleteKey(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req KeyOperationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		ah.logger.Warn("Invalid JSON in delete request", "error", err)
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Value == "" {
		ah.logger.Warn("Missing key value in delete request")
		http.Error(w, "Key value is required", http.StatusBadRequest)
		return
	}

	// Check if key exists before deletion
	_, exists := ah.km.FindKeyByValue(req.Value)
	if !exists {
		ah.logger.Warn("Attempted to delete non-existent key", "key_value", req.Value)
		http.Error(w, "Key not found", http.StatusNotFound)
		return
	}

	// Delete the key
	ah.km.DeleteKey(req.Value)

	// Save state to file after successful deletion
	if err := ah.km.SaveState(); err != nil {
		ah.logger.Error("Failed to save state after deleting key", "error", err)
		http.Error(w, "Failed to save state", http.StatusInternalServerError)
		return
	}

	// Return 204 No Content
	w.WriteHeader(http.StatusNoContent)

	ah.logger.Info("Deleted key", "key_value", req.Value)
}

// ReactivateKey handles POST /admin/api/keys/reactivate requests
func (ah *AdminHandler) ReactivateKey(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req KeyOperationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		ah.logger.Warn("Invalid JSON in reactivate request", "error", err)
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Value == "" {
		ah.logger.Warn("Missing key value in reactivate request")
		http.Error(w, "Key value is required", http.StatusBadRequest)
		return
	}

	// Check if key exists
	key, exists := ah.km.FindKeyByValue(req.Value)
	if !exists {
		ah.logger.Warn("Attempted to reactivate non-existent key", "key_value", req.Value)
		http.Error(w, "Key not found", http.StatusNotFound)
		return
	}

	// Reactivate the key
	ah.km.ReactivateKey(req.Value)

	// Save state to file after successful reactivation
	if err := ah.km.SaveState(); err != nil {
		ah.logger.Error("Failed to save state after reactivating key", "error", err)
		http.Error(w, "Failed to save state", http.StatusInternalServerError)
		return
	}

	// Get the updated key to return
	updatedKey, _ := ah.km.FindKeyByValue(req.Value)

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	// Return the reactivated key
	if err := json.NewEncoder(w).Encode(updatedKey); err != nil {
		ah.logger.Error("Failed to encode reactivated key to JSON", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	ah.logger.Info("Reactivated key", "key_value", req.Value, "previous_status", key.Status)
}

// DisableKey handles POST /admin/api/keys/disable requests
func (ah *AdminHandler) DisableKey(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req DisableKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		ah.logger.Warn("Invalid JSON in disable request", "error", err)
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Value == "" {
		ah.logger.Warn("Missing key value in disable request")
		http.Error(w, "Key value is required", http.StatusBadRequest)
		return
	}

	// Check if key exists
	key, exists := ah.km.FindKeyByValue(req.Value)
	if !exists {
		ah.logger.Warn("Attempted to disable non-existent key", "key_value", req.Value)
		http.Error(w, "Key not found", http.StatusNotFound)
		return
	}

	// Use provided reason or default
	reason := req.Reason
	if reason == "" {
		reason = "Manually disabled by user"
	}

	// Disable the key
	ah.km.DisableKey(req.Value, reason)

	// Save state to file after successful disabling
	if err := ah.km.SaveState(); err != nil {
		ah.logger.Error("Failed to save state after disabling key", "error", err)
		http.Error(w, "Failed to save state", http.StatusInternalServerError)
		return
	}

	// Get the updated key to return
	updatedKey, _ := ah.km.FindKeyByValue(req.Value)

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	// Return the disabled key
	if err := json.NewEncoder(w).Encode(updatedKey); err != nil {
		ah.logger.Error("Failed to encode disabled key to JSON", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	ah.logger.Info("Disabled key", "key_value", req.Value, "previous_status", key.Status)
}

// TestKeysRequest represents the request body for testing keys
type TestKeysRequest struct {
	Source string   `json:"source"` // "system" or "custom"
	Model  string   `json:"model"`
	Keys   []string `json:"keys,omitempty"` // omitempty表示如果为空则不序列化
}

// TestResult represents the result of testing a single key
type TestResult struct {
	KeyValue string `json:"key_value"`
	Status   string `json:"status"` // "success" or "failed"
	Message  string `json:"message,omitempty"`
	Error    string `json:"error,omitempty"`
}

// TestKeys handles POST /admin/api/keys/test requests with Server-Sent Events
func (ah *AdminHandler) TestKeys(w http.ResponseWriter, r *http.Request) {
	// Parse request - support both JSON body and URL query parameters
	var req TestKeysRequest

	// Try to parse from query parameters first (for EventSource compatibility)
	if source := r.URL.Query().Get("source"); source != "" {
		req.Source = source
		req.Model = r.URL.Query().Get("model")

		// Parse keys from query parameter if provided
		if keysParam := r.URL.Query().Get("keys"); keysParam != "" {
			// Keys are passed as comma-separated values
			req.Keys = strings.Split(keysParam, ",")
			// Trim whitespace from each key
			for i, key := range req.Keys {
				req.Keys[i] = strings.TrimSpace(key)
			}
		}

		// For EventSource requests, check token in URL parameter
		if token := r.URL.Query().Get("token"); token != "" {
			// Validate the token manually since middleware won't handle it
			if !ah.validateAdminToken(token) {
				ah.logger.Warn("Invalid admin token in URL parameter")
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
		} else {
			// No token in URL, this should be handled by middleware
			// But EventSource can't send custom headers, so this is an error
			ah.logger.Warn("No admin token provided for EventSource request")
			http.Error(w, "Unauthorized: Token required in URL parameter for EventSource", http.StatusUnauthorized)
			return
		}
	} else {
		// Fallback to JSON body parsing
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			ah.logger.Warn("Failed to parse test keys request", "error", err)
			http.Error(w, "Invalid JSON request body", http.StatusBadRequest)
			return
		}
	}

	// Validate model ID
	if req.Model == "" {
		ah.logger.Warn("Empty model ID provided for key testing")
		http.Error(w, "Model ID is required", http.StatusBadRequest)
		return
	}

	// Create keysToTest slice based on source
	var keysToTest []string
	switch req.Source {
	case "system":
		// Get all system keys from KeyManager
		systemKeys := ah.km.ListKeys()
		for _, key := range systemKeys {
			keysToTest = append(keysToTest, key.Value)
		}
	case "custom":
		// Use provided custom keys
		keysToTest = req.Keys
	default:
		ah.logger.Warn("Invalid source provided for key testing", "source", req.Source)
		http.Error(w, "Source must be 'system' or 'custom'", http.StatusBadRequest)
		return
	}

	// Validate that we have keys to test
	if len(keysToTest) == 0 {
		ah.logger.Warn("No keys provided for testing")
		http.Error(w, "No keys to test", http.StatusBadRequest)
		return
	}

	// Set headers for Server-Sent Events
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Get flusher for immediate response streaming
	flusher, ok := w.(http.Flusher)
	if !ok {
		ah.logger.Error("Streaming not supported")
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	ah.logger.Info("Starting key health test", "model", req.Model, "source", req.Source, "key_count", len(keysToTest))

	// Create HTTP client for testing
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Track if any keys state were changed during this test run
	var keysStateChanged bool = false

	// Test each key
	for i, keyValue := range keysToTest {
		ah.logger.Debug("Testing key", "key_index", i+1, "total", len(keysToTest))

		result := ah.testSingleKeyValue(client, keyValue, req.Model, i)

		// **Auto-manage key states for system tests**
		if req.Source == "system" {
			if result.Status == "failed" {
				// Automatically disable the invalid key
				ah.km.DisableKey(keyValue, result.Error)
				keysStateChanged = true
				ah.logger.Warn("Automatically disabled invalid key found during health check",
					"key", keyValue, "reason", result.Error)
			} else if result.Status == "success" {
				// Automatically enable the valid key if it was previously disabled
				if ah.km.IsKeyDisabled(keyValue) {
					ah.km.ReactivateKey(keyValue)
					keysStateChanged = true
					ah.logger.Info("Automatically enabled valid key found during health check",
						"key", keyValue)
				}
			}
		}

		// Serialize result to JSON
		jsonData, err := json.Marshal(result)
		if err != nil {
			ah.logger.Error("Failed to marshal test result", "error", err)
			continue
		}

		// Send SSE data
		fmt.Fprintf(w, "data: %s\n\n", string(jsonData))
		flusher.Flush()

		// Small delay between tests to avoid overwhelming the API
		time.Sleep(100 * time.Millisecond)
	}

	// **Persist state if any keys state were changed**
	if keysStateChanged {
		if err := ah.km.SaveState(); err != nil {
			ah.logger.Error("Failed to save state after auto-managing keys", "error", err)
		} else {
			ah.logger.Info("State saved successfully after auto-managing key states")
		}
	}

	// Send completion event
	completionResult := map[string]interface{}{
		"type":    "complete",
		"message": "All keys tested",
		"total":   len(keysToTest),
	}
	jsonData, _ := json.Marshal(completionResult)
	fmt.Fprintf(w, "data: %s\n\n", string(jsonData))
	flusher.Flush()

	ah.logger.Info("Key health test completed", "total_keys", len(keysToTest))
}

// testSingleKey tests a single API key by making a lightweight request to ModelScope
func (ah *AdminHandler) testSingleKey(client *http.Client, key *keymanager.ApiKey, model string) TestResult {
	// Create a minimal test request
	testRequest := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": "Hi",
			},
		},
		"max_tokens": 1,
		"stream":     false,
	}

	// Marshal request to JSON
	requestBody, err := json.Marshal(testRequest)
	if err != nil {
		return TestResult{
			KeyValue: key.Value,
			Status:   "failed",
			Error:    fmt.Sprintf("Failed to marshal request: %v", err),
		}
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", "https://api-inference.modelscope.cn/v1/chat/completions", bytes.NewReader(requestBody))
	if err != nil {
		return TestResult{
			KeyValue: key.Value,
			Status:   "failed",
			Error:    fmt.Sprintf("Failed to create request: %v", err),
		}
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key.Value)

	// Send request
	resp, err := client.Do(req)
	if err != nil {
		return TestResult{
			KeyValue: key.Value,
			Status:   "failed",
			Error:    fmt.Sprintf("Network error: %v", err),
		}
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode == http.StatusOK {
		return TestResult{
			KeyValue: key.Value,
			Status:   "success",
			Message:  "Key is working correctly",
		}
	} else {
		// Read error response
		body := make([]byte, 1024)
		n, _ := resp.Body.Read(body)
		errorMsg := string(body[:n])
		if len(errorMsg) > 200 {
			errorMsg = errorMsg[:200] + "..."
		}

		return TestResult{
			KeyValue: key.Value,
			Status:   "failed",
			Error:    fmt.Sprintf("HTTP %d: %s", resp.StatusCode, errorMsg),
		}
	}
}

// testSingleKeyValue tests a single API key value by making a lightweight request to ModelScope
func (ah *AdminHandler) testSingleKeyValue(client *http.Client, keyValue string, model string, index int) TestResult {
	// Create a minimal test request
	testRequest := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": "Hi",
			},
		},
		"max_tokens": 1,
		"stream":     false,
	}

	// Marshal request to JSON
	requestBody, err := json.Marshal(testRequest)
	if err != nil {
		return TestResult{
			KeyValue: keyValue,
			Status:   "failed",
			Error:    fmt.Sprintf("Failed to marshal request: %v", err),
		}
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", "https://api-inference.modelscope.cn/v1/chat/completions", bytes.NewReader(requestBody))
	if err != nil {
		return TestResult{
			KeyValue: keyValue,
			Status:   "failed",
			Error:    fmt.Sprintf("Failed to create request: %v", err),
		}
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+keyValue)

	// Send request
	resp, err := client.Do(req)
	if err != nil {
		return TestResult{
			KeyValue: keyValue,
			Status:   "failed",
			Error:    fmt.Sprintf("Network error: %v", err),
		}
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode == http.StatusOK {
		return TestResult{
			KeyValue: keyValue,
			Status:   "success",
			Message:  "Key is working correctly",
		}
	} else {
		// Read error response
		body := make([]byte, 1024)
		n, _ := resp.Body.Read(body)
		errorMsg := string(body[:n])
		if len(errorMsg) > 200 {
			errorMsg = errorMsg[:200] + "..."
		}

		return TestResult{
			KeyValue: keyValue,
			Status:   "failed",
			Error:    fmt.Sprintf("HTTP %d: %s", resp.StatusCode, errorMsg),
		}
	}
}

// ProxiedGetModels handles GET /admin/api/proxied-models requests
// This method is protected by AdminAuthMiddleware, so we know the caller is authorized
func (ah *AdminHandler) ProxiedGetModels(w http.ResponseWriter, r *http.Request) {
	// Get an available key from KeyManager
	key := ah.km.GetNextActiveKey()
	if key == nil {
		ah.logger.Warn("No available keys for proxied models request")
		http.Error(w, "Service Unavailable: No available keys to execute this proxy operation", http.StatusServiceUnavailable)
		return
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// Create request to upstream ModelScope API
	req, err := http.NewRequest("GET", "https://api-inference.modelscope.cn/v1/models", nil)
	if err != nil {
		ah.logger.Error("Failed to create upstream request", "error", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Set authorization header with the selected key
	req.Header.Set("Authorization", "Bearer "+key.Value)
	req.Header.Set("Content-Type", "application/json")

	// Execute request with retry logic
	var resp *http.Response
	maxRetries := 3
	for i := 0; i < maxRetries; i++ {
		resp, err = client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			break
		}

		if resp != nil {
			resp.Body.Close()
		}

		if i < maxRetries-1 {
			ah.logger.Warn("Upstream request failed, retrying", "attempt", i+1, "error", err)
			time.Sleep(time.Duration(i+1) * time.Second)
		}
	}

	if err != nil {
		ah.logger.Error("Failed to execute upstream request after retries", "error", err)
		http.Error(w, "Bad Gateway: Upstream service unavailable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		ah.logger.Warn("Upstream returned non-200 status", "status", resp.StatusCode)
		http.Error(w, "Bad Gateway: Upstream service or key issue", http.StatusBadGateway)
		return
	}

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Set status code and copy response body
	w.WriteHeader(resp.StatusCode)
	_, err = io.Copy(w, resp.Body)
	if err != nil {
		ah.logger.Error("Failed to copy response body", "error", err)
	}

	ah.logger.Info("Successfully proxied models request", "key_value", key.Value)
}

// BatchAddKeysRequest represents the request body for batch adding keys
type BatchAddKeysRequest struct {
	Keys []string `json:"keys"`
}

// BatchAddKeysResponse represents the response for batch adding keys
type BatchAddKeysResponse struct {
	Message      string `json:"message"`
	AddedCount   int    `json:"added_count"`
	SkippedCount int    `json:"skipped_count"`
}

// BatchAddKeys handles POST /admin/api/keys/batch-add requests
func (ah *AdminHandler) BatchAddKeys(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req BatchAddKeysRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		ah.logger.Warn("Failed to parse batch add keys request", "error", err)
		http.Error(w, "Invalid JSON request body", http.StatusBadRequest)
		return
	}

	// Validate that we have keys to add
	if len(req.Keys) == 0 {
		ah.logger.Warn("No keys provided for batch add")
		http.Error(w, "No keys provided", http.StatusBadRequest)
		return
	}

	addedCount := 0
	skippedCount := 0

	// Add each key to the system
	for _, keyValue := range req.Keys {
		keyValue = strings.TrimSpace(keyValue)
		if keyValue == "" {
			skippedCount++
			continue
		}

		// Check if key already exists
		existingKeys := ah.km.ListKeys()
		exists := false
		for _, existingKey := range existingKeys {
			if existingKey.Value == keyValue {
				exists = true
				break
			}
		}

		if exists {
			ah.logger.Debug("Key already exists, skipping", "key_prefix", keyValue[:min(8, len(keyValue))])
			skippedCount++
			continue
		}

		// Add the key
		newKey := ah.km.AddKey(keyValue)
		if newKey != nil {
			addedCount++
			ah.logger.Debug("Added key successfully", "key_value", newKey.Value)
		} else {
			skippedCount++
			ah.logger.Warn("Failed to add key", "key_prefix", keyValue[:min(8, len(keyValue))])
		}
	}

	// Save state once after all additions
	if addedCount > 0 {
		if err := ah.km.SaveState(); err != nil {
			ah.logger.Error("Failed to save state after batch add", "error", err)
			http.Error(w, "Failed to save keys", http.StatusInternalServerError)
			return
		}
	}

	// Prepare response
	response := BatchAddKeysResponse{
		Message:      fmt.Sprintf("Successfully processed %d keys. Added: %d, Skipped: %d", len(req.Keys), addedCount, skippedCount),
		AddedCount:   addedCount,
		SkippedCount: skippedCount,
	}

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	// Return the response
	if err := json.NewEncoder(w).Encode(response); err != nil {
		ah.logger.Error("Failed to encode batch add response to JSON", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	ah.logger.Info("Batch add keys completed", "added_count", addedCount, "skipped_count", skippedCount)
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GetSettings handles GET /admin/api/settings requests
func (ah *AdminHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	// Get all current settings from the global Viper instance
	settings := config.AppViper.AllSettings()

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	// Return settings as JSON
	if err := json.NewEncoder(w).Encode(settings); err != nil {
		ah.logger.Error("Failed to encode settings to JSON", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	ah.logger.Info("Retrieved application settings")
}

// UpdateSettings handles POST /admin/api/settings requests
func (ah *AdminHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var newSettings map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&newSettings); err != nil {
		ah.logger.Warn("Failed to parse settings update request", "error", err)
		http.Error(w, "Invalid JSON request body", http.StatusBadRequest)
		return
	}

	// Update Viper instance with new settings
	for key, value := range newSettings {
		config.AppViper.Set(key, value)
		ah.logger.Debug("Updated setting", "key", key, "value", value)
	}

	// Write configuration back to file for persistence
	if err := config.AppViper.WriteConfig(); err != nil {
		ah.logger.Error("Failed to write configuration to file", "error", err)
		http.Error(w, "Failed to save settings", http.StatusInternalServerError)
		return
	}

	// Check if auto-reactivation settings were updated and restart scheduler if needed
	if autoReactivationSettings, exists := newSettings["auto_reactivation"]; exists {
		ah.logger.Info("Auto-reactivation settings updated, restarting scheduler")

		// Parse the auto-reactivation settings
		var autoReactivation config.AutoReactivationSettings
		if settingsMap, ok := autoReactivationSettings.(map[string]interface{}); ok {
			if enabled, ok := settingsMap["enabled"].(bool); ok {
				autoReactivation.Enabled = enabled
			}
			if mode, ok := settingsMap["mode"].(string); ok {
				autoReactivation.Mode = mode
			}
			if interval, ok := settingsMap["interval"].(string); ok {
				autoReactivation.Interval = interval
			}
			if cronSpec, ok := settingsMap["cron_spec"].(string); ok {
				autoReactivation.CronSpec = cronSpec
			}
			if timezone, ok := settingsMap["timezone"].(string); ok {
				autoReactivation.Timezone = timezone
			}
		}

		// Restart the scheduler with new settings
		if ah.scheduler != nil {
			ah.scheduler.Start(autoReactivation)
			ah.logger.Info("Scheduler restarted with new settings",
				"enabled", autoReactivation.Enabled,
				"mode", autoReactivation.Mode,
				"interval", autoReactivation.Interval,
				"cron_spec", autoReactivation.CronSpec,
				"timezone", autoReactivation.Timezone)
		}
	}

	// Return success response
	response := map[string]string{
		"message": "Settings updated successfully.",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(response); err != nil {
		ah.logger.Error("Failed to encode response to JSON", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	ah.logger.Info("Updated application settings", "settings_count", len(newSettings))
}
