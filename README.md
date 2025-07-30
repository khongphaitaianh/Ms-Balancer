# ModelScope Balancer

ModelScope Balancer is an intelligent API key load balancer designed for [ModelScope](https://modelscope.cn) API. It balances requests across multiple API keys to increase request capacity and ensure service continuity.

## Features

### 🔧 Core Functionality
- **Multi-key Round-Robin**: Automatically distribute requests across multiple ModelScope API keys
- **Automatic Failover**: Automatically disable failed keys and switch to available ones
- **Health Checks**: Regularly test API key validity
- **Auto Reactivation**: Support scheduled or interval-based reactivation of disabled keys
- **State Persistence**: Save key states to local file storage

### 🌐 Management Interface
- **Modern Web UI**: User-friendly interface built with HTML/CSS/JavaScript
- **Key Management**: Add, delete, disable, and reactivate keys
- **Real-time Monitoring**: View key status and usage statistics
- **Batch Operations**: Support batch import, export, and testing of keys

### ⚙️ Technical Features
- **Flexible Configuration**: Configure via `config.toml` file
- **Dual Authentication**: Admin token protects the management interface, API token protects proxy endpoints
- **Structured Logging**: Structured logs for easy troubleshooting
- **Embedded Deployment**: Frontend resources embedded in binary for easy deployment

## Tech Stack

- **Backend**: Go 1.24.5 + Chi Router + Viper Configuration
- **Frontend**: HTML5 + CSS3 + JavaScript + Tailwind CSS
- **Data Storage**: TOML Configuration + JSON State Files
- **Scheduling**: Cron Scheduler for timed tasks

## Quick Start

### 1. Configuration File

Create a `config.toml` file:

```toml
# Server listening address
server_address = ":8981"

# Admin token (for accessing management interface)
admin_token = "your-admin-token"

# API token (for protecting /v1 proxy endpoints)
api_token = "your-api-token"

# ModelScope API key list
api_keys = [
    "your-modelscope-api-key-1",
    "your-modelscope-api-key-2",
    # Add more keys as needed
]

# Auto reactivation settings
[auto_reactivation]
enabled = true           # Enable auto reactivation
mode = "interval"        # Run mode: interval or scheduled
interval = "10m"         # Reactivation interval in interval mode (10 minutes)
cron_spec = "0 0 * * *"  # Cron expression in scheduled mode (daily at midnight)
timezone = "Asia/Shanghai"  # Timezone setting
```

### 2. Run the Application

```bash
# Build the project
go build -o modelscope-balancer

# Run the application
./modelscope-balancer
```

### 3. Access Management Interface

Open your browser and navigate to `http://localhost:8981`, then login with the admin token configured in your config file.

## Usage

### API Proxy

The application proxies ModelScope API requests, distributing them across different API keys:

```bash
# Use the proxy endpoint to call ModelScope API
curl -X POST http://localhost:8981/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Web Management Interface

Through the web interface, you can:
- Manage API keys (add, delete, disable, reactivate)
- View key status and statistics
- Perform health check tests
- Configure auto reactivation settings

## Configuration Details

### Server Configuration
- `server_address`: Server listening address and port
- `admin_token`: Token required to access the management interface
- `api_token`: Token required to access proxy endpoints

### API Key Management
- `api_keys`: Initial list of API keys
- Key states are saved in the `state.json` file

### Auto Reactivation
- `enabled`: Enable/disable auto reactivation feature
- `mode`: Run mode
  - `interval`: Run at fixed time intervals
  - `scheduled`: Run based on Cron expressions
- `interval`: Time interval in interval mode (supports formats like "10m", "1h30m", "2h")
- `cron_spec`: Cron expression in scheduled mode
- `timezone`: Timezone setting

## Troubleshooting

### Common Issues

1. **Cannot Access Management Interface**
   - Check if `admin_token` is correctly configured
   - Confirm the server is running properly

2. **API Requests Fail**
   - Check if `api_token` is correctly configured
   - Confirm ModelScope API keys are valid

3. **Key Status Issues**
   - Check log files for detailed error information
   - Use health check feature to test key validity

### Viewing Logs

The application uses structured logging. You can view logs as follows:

```bash
# Run directly to see real-time logs
./modelscope-balancer

# Or save logs to a file
./modelscope-balancer > app.log 2>&1
```

## Contributing

Issues and Pull Requests are welcome to improve this project.

## License

[MIT License](LICENSE)