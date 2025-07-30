package keymanager

import (
	"encoding/json"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// KeyManager manages a pool of API keys with thread-safe operations
type KeyManager struct {
	mu            sync.RWMutex // Protects concurrent access to the keys slice
	keys          []*ApiKey    // Stores all API key objects
	currentIndex  atomic.Int64 // Used for efficient round-robin selection
	logger        *slog.Logger // Logger for key management operations
	stateFilePath string       // Path to the state file for persistence
}

// New creates a new KeyManager instance with the provided API keys and state file path
func New(apiKeys []string, stateFilePath string, logger *slog.Logger) *KeyManager {
	km := &KeyManager{
		keys:          make([]*ApiKey, 0, len(apiKeys)),
		logger:        logger,
		stateFilePath: stateFilePath,
	}

	// Initialize each API key from the provided strings
	for _, keyValue := range apiKeys {
		apiKey := &ApiKey{
			Value:  keyValue,     // Store the actual API key value
			Status: StatusActive, // Set initial status to active
			Source: "config",     // Mark as config-sourced key
		}
		km.keys = append(km.keys, apiKey)
	}

	return km
}

// GetNextActiveKey returns the next active API key using round-robin selection
// This is the core of load balancing functionality
func (km *KeyManager) GetNextActiveKey() *ApiKey {
	km.mu.RLock()
	defer km.mu.RUnlock()

	// Return nil if no keys are available
	if len(km.keys) == 0 {
		return nil
	}

	// Loop at most twice the length of the list to ensure we exit if all keys are disabled
	maxAttempts := len(km.keys) * 2
	for i := 0; i < maxAttempts; i++ {
		// Atomically increment and get the current index
		index := km.currentIndex.Add(1) % int64(len(km.keys))
		key := km.keys[index]

		// Return the key if it's active
		if key.Status == StatusActive {
			return key
		}
	}

	// No active keys found
	return nil
}

// DisableKey disables a key by value and records the failure reason
func (km *KeyManager) DisableKey(keyValue string, reason string) {
	km.mu.Lock()
	defer km.mu.Unlock()

	// Find the key by value and disable it
	for _, key := range km.keys {
		if key.Value == keyValue {
			key.Status = StatusDisabled
			key.DisabledAt = time.Now()
			key.LastFailureReason = reason
			return
		}
	}
}

// ListKeys returns a copy of all keys for display in the web management interface
func (km *KeyManager) ListKeys() []*ApiKey {
	km.mu.RLock()
	defer km.mu.RUnlock()

	// Return a copy of the slice to prevent external modification
	keysCopy := make([]*ApiKey, len(km.keys))
	copy(keysCopy, km.keys)
	return keysCopy
}

// FindKeyByID finds a key by its ID and returns it along with a boolean indicating if found
func (km *KeyManager) FindKeyByValue(keyValue string) (*ApiKey, bool) {
	km.mu.RLock()
	defer km.mu.RUnlock()

	// Search for the key by value
	for _, key := range km.keys {
		if key.Value == keyValue {
			return key, true
		}
	}
	return nil, false
}

// ReactivateKey reactivates a disabled key by value
func (km *KeyManager) ReactivateKey(keyValue string) {
	km.mu.Lock()
	defer km.mu.Unlock()

	// Find the key by value and reactivate it
	for _, key := range km.keys {
		if key.Value == keyValue {
			key.Status = StatusActive
			key.LastFailureReason = "" // Clear the failure reason
			return
		}
	}
}

// IsKeyDisabled checks if a key is currently disabled
func (km *KeyManager) IsKeyDisabled(keyValue string) bool {
	km.mu.RLock()
	defer km.mu.RUnlock()

	// Find the key by value and check its status
	for _, key := range km.keys {
		if key.Value == keyValue {
			return key.Status == StatusDisabled
		}
	}
	// If key not found, consider it as not disabled (doesn't exist)
	return false
}

// AddKey adds a new API key to the manager and returns the created key
func (km *KeyManager) AddKey(keyValue string) *ApiKey {
	km.mu.Lock()
	defer km.mu.Unlock()

	// Create new API key
	apiKey := &ApiKey{
		Value:  keyValue,     // Store the actual API key value
		Status: StatusActive, // Set initial status to active
		Source: "user",       // Mark as user-added key
	}

	// Add to the keys slice
	km.keys = append(km.keys, apiKey)

	km.logger.Info("Added new API key", "key_value", keyValue)
	return apiKey
}

// DeleteKey removes an API key from the manager by value
func (km *KeyManager) DeleteKey(keyValue string) bool {
	km.mu.Lock()
	defer km.mu.Unlock()

	// Find and remove the key by value
	for i, key := range km.keys {
		if key.Value == keyValue {
			// Remove the key from the slice
			km.keys = append(km.keys[:i], km.keys[i+1:]...)
			km.logger.Info("Deleted API key", "key_value", keyValue)
			return true
		}
	}

	km.logger.Warn("Attempted to delete non-existent key", "key_value", keyValue)
	return false
}

// ReactivateDisabledKeys automatically reactivates keys that have been disabled for longer than the threshold
func (km *KeyManager) ReactivateDisabledKeys(threshold time.Duration) {
	km.mu.Lock()
	defer km.mu.Unlock()

	reactivatedCount := 0

	// Iterate through all keys
	for _, key := range km.keys {
		// Check if key is disabled and has been disabled longer than threshold
		if key.Status == StatusDisabled && time.Since(key.DisabledAt) > threshold {
			// Reactivate the key
			key.Status = StatusActive
			key.LastFailureReason = "" // Clear the failure reason
			reactivatedCount++

			// Log the reactivation
			km.logger.Info("Automatically reactivated disabled key",
				"key_value", key.Value,
				"disabled_duration", time.Since(key.DisabledAt).String())
		}
	}

	// Log summary if any keys were reactivated
	if reactivatedCount > 0 {
		km.logger.Info("Automatic key reactivation completed",
			"reactivated_count", reactivatedCount,
			"threshold", threshold.String())
	}
}

// ReactivateAllDisabledKeys reactivates all disabled keys unconditionally
// This is used for scheduled reactivation tasks
func (km *KeyManager) ReactivateAllDisabledKeys() {
	km.mu.Lock()
	defer km.mu.Unlock()

	reactivatedCount := 0

	// Iterate through all keys
	for _, key := range km.keys {
		// Check if key is disabled
		if key.Status == StatusDisabled {
			// Reactivate the key
			key.Status = StatusActive
			key.LastFailureReason = "" // Clear the failure reason
			reactivatedCount++

			// Log the reactivation
			km.logger.Info("Scheduled reactivation of disabled key",
				"key_value", key.Value,
				"disabled_duration", time.Since(key.DisabledAt).String())
		}
	}

	// Log summary
	km.logger.Info("Scheduled key reactivation completed",
		"reactivated_count", reactivatedCount)
}

// SaveState saves the current state of user-added keys to the state file
func (km *KeyManager) SaveState() error {
	// Get a read lock since we only need to read the keys slice
	km.mu.RLock()
	defer km.mu.RUnlock()

	// Filter only user-added keys for persistence
	var userKeys []*ApiKey
	for _, key := range km.keys {
		if key.Source == "user" {
			userKeys = append(userKeys, key)
		}
	}

	// Serialize only user-added keys to JSON with indentation for readability
	jsonData, err := json.MarshalIndent(userKeys, "", "  ")
	if err != nil {
		km.logger.Error("Failed to marshal user keys to JSON", "error", err)
		return err
	}

	// Write the JSON data to the state file
	err = os.WriteFile(km.stateFilePath, jsonData, 0644)
	if err != nil {
		km.logger.Error("Failed to write state file", "path", km.stateFilePath, "error", err)
		return err
	}

	km.logger.Info("State saved successfully", "path", km.stateFilePath, "user_keys_count", len(userKeys))
	return nil
}

// LoadState loads user-added keys from the state file and appends them to existing config keys
func (km *KeyManager) LoadState() error {
	// Check if the state file exists
	if _, err := os.Stat(km.stateFilePath); os.IsNotExist(err) {
		// File doesn't exist, this is the first run - return nil
		km.logger.Info("State file does not exist, starting with fresh state", "path", km.stateFilePath)
		return nil
	}

	// Read the state file
	jsonData, err := os.ReadFile(km.stateFilePath)
	if err != nil {
		km.logger.Error("Failed to read state file", "path", km.stateFilePath, "error", err)
		return err
	}

	// Get a write lock since we're going to modify the keys slice
	km.mu.Lock()
	defer km.mu.Unlock()

	// Unmarshal the JSON data into a temporary slice (these are user-added keys)
	var userKeys []*ApiKey
	err = json.Unmarshal(jsonData, &userKeys)
	if err != nil {
		km.logger.Error("Failed to unmarshal state file", "path", km.stateFilePath, "error", err)
		return err
	}

	// Append user-added keys to the existing config keys
	km.keys = append(km.keys, userKeys...)

	km.logger.Info("State loaded successfully", "path", km.stateFilePath, "user_keys_count", len(userKeys), "total_keys_count", len(km.keys))
	return nil
}
