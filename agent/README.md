# BackApp Agent

Client-side backup agent for BackApp. Runs on your local machine to back up files directly to S3.

## Features

- 🔐 Secure authentication with API keys
- 📦 Automatic tar.gz compression
- ☁️ Direct S3 uploads via pre-signed URLs
- 📊 Real-time status reporting to server
- 🔄 Handles multiple backup configurations
- 🪵 Comprehensive logging (local and remote)

## Installation

1. Download the agent from your BackApp dashboard
2. Extract the files to a directory on your machine
3. Install dependencies:

```bash
npm install
```

## Configuration

1. Copy the example configuration:

```bash
cp config.example.json config.json
```

2. Edit `config.json` and add your API key:

```json
{
  "apiKey": "your-api-key-from-backapp",
  "serverUrl": "https://backapp.davidhsells.org",
  "agent": {
    "name": "My MacBook",
    "platform": "darwin",
    "version": "1.0.0"
  },
  "logLevel": "info"
}
```

### Getting Your API Key

1. Log in to BackApp
2. Go to the Agents page
3. Click "Register New Agent"
4. Copy the API key (it will only be shown once!)
5. Paste it into your `config.json` file

## Usage

Run a backup cycle:

```bash
npm start
```

Or using node directly:

```bash
node src/index.js
```

The agent will:
1. Connect to the server and authenticate
2. Fetch all backup configurations assigned to it
3. For each configuration:
   - Validate source paths exist
   - Create a compressed tar.gz archive
   - Upload to S3 using a pre-signed URL
   - Report success/failure to the server
4. Display a summary of all backups

## Scheduling Backups

### macOS (launchd)

Create a plist file at `~/Library/LaunchAgents/com.backapp.agent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.backapp.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/agent/src/index.js</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.backapp.agent.plist
```

### Linux (cron)

Add to crontab:

```bash
# Run every hour
0 * * * * cd /path/to/agent && /usr/bin/node src/index.js >> /var/log/backapp-agent.log 2>&1
```

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily at 2 AM)
4. Action: Start a program
   - Program: `node.exe`
   - Arguments: `src\index.js`
   - Start in: `C:\path\to\agent`

## Logs

The agent logs to both:
- **Console**: All log levels based on `logLevel` config
- **Server**: Info, warn, and error messages sent to BackApp

Log levels: `debug`, `info`, `warn`, `error`

## Troubleshooting

### "Configuration file not found"

Make sure you've created `config.json` from `config.example.json`.

### "API key not configured"

Edit `config.json` and replace `YOUR_API_KEY_HERE` with your actual API key.

### "Invalid API key"

Your API key may be incorrect or the agent may have been deleted from the server. Generate a new API key from the BackApp dashboard.

### "Source path does not exist"

The backup configuration references a path that doesn't exist on your machine. Check:
1. The path is correct for your operating system
2. The directory/file exists
3. You have read permissions

### "Failed to fetch configs"

Check:
1. Your internet connection
2. The `serverUrl` in `config.json` is correct
3. The server is running and accessible

## Security

- **API Key**: Treat your API key like a password. Never commit `config.json` to version control.
- **Pre-signed URLs**: Upload URLs are time-limited (1 hour) and scoped to specific S3 paths.
- **Path Isolation**: Each agent can only upload to its designated S3 path.

## Version

Current version: 1.0.0

## Support

For issues or questions, contact your BackApp administrator.
