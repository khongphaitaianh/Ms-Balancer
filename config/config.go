package config

import (
	"github.com/spf13/viper"
)

// AppViper is the global Viper instance for configuration management
var AppViper *viper.Viper

// AutoReactivationSettings represents the auto-reactivation configuration
type AutoReactivationSettings struct {
	Enabled  bool   `mapstructure:"enabled"`
	Mode     string `mapstructure:"mode"`
	Interval string `mapstructure:"interval"`
	CronSpec string `mapstructure:"cron_spec"`
	Timezone string `mapstructure:"timezone"`
}

// Config represents the application configuration
type Config struct {
	ServerAddress    string                   `mapstructure:"server_address"`
	ApiKeys          []string                 `mapstructure:"api_keys"`
	AdminToken       string                   `mapstructure:"admin_token"`
	ApiToken         string                   `mapstructure:"api_token"`
	AutoReactivation AutoReactivationSettings `mapstructure:"auto_reactivation"`
}

// Load loads configuration from file and environment variables
func Load() (Config, error) {
	var cfg Config

	// Initialize the global viper instance
	AppViper = viper.New()

	// Set configuration file name (viper will automatically look for .yaml, .json, etc.)
	AppViper.SetConfigName("config")

	// Set configuration file search path to current directory
	AppViper.AddConfigPath(".")

	// Allow reading from environment variables
	AppViper.AutomaticEnv()

	// Set default values
	AppViper.SetDefault("server_address", ":8980")
	AppViper.SetDefault("admin_token", "")
	AppViper.SetDefault("api_token", "")

	// Set default auto-reactivation settings
	AppViper.SetDefault("auto_reactivation.enabled", true)
	AppViper.SetDefault("auto_reactivation.mode", "interval")
	AppViper.SetDefault("auto_reactivation.interval", "10m")
	AppViper.SetDefault("auto_reactivation.cron_spec", "0 */10 * * * *")
	AppViper.SetDefault("auto_reactivation.timezone", "Local")

	// Try to read configuration file
	// If file doesn't exist, ignore the error as config might be provided entirely by environment variables
	if err := AppViper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			// Config file was found but another error was produced
			return cfg, err
		}
		// Config file not found; ignore error as we can use environment variables
	}

	// Unmarshal the loaded configuration into our Config struct
	if err := AppViper.Unmarshal(&cfg); err != nil {
		return cfg, err
	}

	return cfg, nil
}
