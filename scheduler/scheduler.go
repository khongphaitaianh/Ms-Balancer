package scheduler

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/loseleaf/modelscope-balancer/config"
	"github.com/loseleaf/modelscope-balancer/keymanager"
)

// Scheduler manages scheduled tasks for key reactivation
type Scheduler struct {
	cron   *cron.Cron
	km     *keymanager.KeyManager
	logger *slog.Logger
}

// New creates a new Scheduler instance
func New(km *keymanager.KeyManager, logger *slog.Logger) *Scheduler {
	return &Scheduler{
		cron:   cron.New(),
		km:     km,
		logger: logger,
	}
}

// Start starts the scheduler with the given configuration
func (s *Scheduler) Start(cfg config.AutoReactivationSettings) {
	// Check if auto-reactivation is enabled
	if !cfg.Enabled {
		s.logger.Info("Auto-reactivation is disabled")
		return
	}

	// Stop old tasks if scheduler is already running
	if len(s.cron.Entries()) > 0 {
		s.logger.Info("Stopping existing scheduled tasks")
		s.cron.Stop()
		s.cron = cron.New() // Create a new cron instance to clear all entries
	}

	// Add new tasks based on mode
	switch cfg.Mode {
	case "interval":
		s.logger.Info("Setting up interval-based auto-reactivation", "interval", cfg.Interval)
		
		// Parse interval duration
		interval, err := time.ParseDuration(cfg.Interval)
		if err != nil {
			s.logger.Error("Invalid interval duration", "interval", cfg.Interval, "error", err)
			return
		}

		// Add interval-based task using @every format
		cronSpec := fmt.Sprintf("@every %s", cfg.Interval)
		_, err = s.cron.AddFunc(cronSpec, func() {
			s.logger.Debug("Running interval-based key reactivation task")
			s.km.ReactivateDisabledKeys(interval)
		})
		
		if err != nil {
			s.logger.Error("Failed to add interval-based task", "error", err)
			return
		}

		s.logger.Info("Added interval-based reactivation task", "interval", cfg.Interval)

	case "scheduled":
		s.logger.Info("Setting up scheduled auto-reactivation", 
			"cron_spec", cfg.CronSpec, "timezone", cfg.Timezone)
		
		// Load timezone
		loc, err := time.LoadLocation(cfg.Timezone)
		if err != nil {
			s.logger.Error("Invalid timezone", "timezone", cfg.Timezone, "error", err)
			return
		}

		// Create new cron instance with timezone support
		s.cron = cron.New(cron.WithLocation(loc))

		// Add scheduled task
		_, err = s.cron.AddFunc(cfg.CronSpec, func() {
			s.logger.Debug("Running scheduled key reactivation task")
			s.km.ReactivateAllDisabledKeys()
		})
		
		if err != nil {
			s.logger.Error("Failed to add scheduled task", "error", err)
			return
		}

		s.logger.Info("Added scheduled reactivation task", 
			"cron_spec", cfg.CronSpec, "timezone", cfg.Timezone)

	default:
		s.logger.Error("Unknown auto-reactivation mode", "mode", cfg.Mode)
		return
	}

	// Start the scheduler
	s.cron.Start()
	s.logger.Info("Scheduler started successfully", "mode", cfg.Mode)
}

// Stop stops the scheduler
func (s *Scheduler) Stop() {
	if s.cron != nil {
		s.cron.Stop()
		s.logger.Info("Scheduler stopped")
	}
}
