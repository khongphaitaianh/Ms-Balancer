package keymanager

import "time"

// KeyStatus represents the status of an API key
type KeyStatus string

// KeyStatus constants
const (
	StatusActive   KeyStatus = "active"
	StatusDisabled KeyStatus = "disabled"
)

// ApiKey represents a ModelScope API key with its metadata
type ApiKey struct {
	Value             string    `json:"value"` // The actual API key value
	Status            KeyStatus `json:"status"`
	DisabledAt        time.Time `json:"disabled_at"`
	LastFailureReason string    `json:"last_failure_reason"` // Records the reason for last failure
	Source            string    `json:"source"`              // "config" or "user" to track key source
}
