# BackApp Agent - Service Installation

This directory contains service definition files and installation scripts for running the BackApp Agent as a background service/daemon on different platforms.

## Platform Support

- **macOS**: LaunchAgent (user-level service)
- **Linux**: Systemd user service
- **Windows**: See Windows installation section below

## Prerequisites

- Node.js installed and in PATH
- BackApp agent configured (config.json with API key)
- Network connectivity to BackApp server

## macOS Installation

### Install as LaunchAgent

```bash
cd services/macos
chmod +x install.sh uninstall.sh
./install.sh
```

The agent will now:
- Start automatically when you log in
- Run in the background continuously
- Poll for backups every 5 minutes
- Restart automatically if it crashes

### Check Status

```bash
# View service status
launchctl list | grep backapp

# View logs (live)
tail -f ~/Library/Logs/backapp-agent.log

# View error logs
tail -f ~/Library/Logs/backapp-agent-error.log
```

### Manage Service

```bash
# Stop service
launchctl unload ~/Library/LaunchAgents/com.backapp.agent.plist

# Start service
launchctl load ~/Library/LaunchAgents/com.backapp.agent.plist

# Uninstall completely
./uninstall.sh
```

## Linux Installation

### Install as Systemd User Service

```bash
cd services/linux
chmod +x install.sh uninstall.sh
./install.sh
```

The agent will now:
- Start automatically when you log in
- Run in the background continuously
- Poll for backups every 5 minutes
- Restart automatically if it crashes

### Keep Running When Logged Out (Optional)

By default, user services stop when you log out. To keep the agent running:

```bash
# Enable lingering (allows services to run when logged out)
sudo loginctl enable-linger $USER
```

### Check Status

```bash
# View service status
systemctl --user status backapp-agent

# View logs (live)
journalctl --user -u backapp-agent -f

# View last 50 log lines
journalctl --user -u backapp-agent -n 50
```

### Manage Service

```bash
# Start service
systemctl --user start backapp-agent

# Stop service
systemctl --user stop backapp-agent

# Restart service
systemctl --user restart backapp-agent

# Enable (start on login)
systemctl --user enable backapp-agent

# Disable (don't start on login)
systemctl --user disable backapp-agent

# Uninstall completely
./uninstall.sh
```

## Windows Installation

### Using NSSM (Non-Sucking Service Manager)

1. Download NSSM from https://nssm.cc/
2. Install the agent as a service:

```cmd
nssm install BackAppAgent "C:\Program Files\nodejs\node.exe" "C:\path\to\backapp-agent\src\daemon.js"
nssm set BackAppAgent AppDirectory "C:\path\to\backapp-agent"
nssm set BackAppAgent AppStdout "C:\path\to\backapp-agent\logs\output.log"
nssm set BackAppAgent AppStderr "C:\path\to\backapp-agent\logs\error.log"
nssm start BackAppAgent
```

### Manage Windows Service

```cmd
# Start service
nssm start BackAppAgent

# Stop service
nssm stop BackAppAgent

# Restart service
nssm restart BackAppAgent

# Remove service
nssm remove BackAppAgent
```

## Configuration

### Poll Interval

The default poll interval is 5 minutes. To change it, edit `src/daemon.js` and modify:

```javascript
this.pollInterval = 5 * 60 * 1000; // Change this value (in milliseconds)
```

After changing, restart the service:
- macOS: `launchctl unload ... && launchctl load ...`
- Linux: `systemctl --user restart backapp-agent`

### Log Level

Set the log level using the `LOG_LEVEL` environment variable:

**macOS** (`com.backapp.agent.plist`):
```xml
<key>EnvironmentVariables</key>
<dict>
    <key>LOG_LEVEL</key>
    <string>debug</string>  <!-- error, warn, info, debug -->
</dict>
```

**Linux** (`backapp-agent.service`):
```ini
Environment="LOG_LEVEL=debug"
```

## Troubleshooting

### Service Won't Start

1. Check Node.js is installed: `which node` or `node --version`
2. Check config.json exists and is valid
3. Check file permissions on daemon.js: `chmod +x src/daemon.js`
4. Check logs for errors (see platform-specific log commands above)

### Service Starts But Doesn't Run Backups

1. Check agent can connect to server: Run manually with `node src/index.js`
2. Verify API key in config.json is correct
3. Check backup configurations are assigned to this agent
4. Review logs for connection errors

### High CPU/Memory Usage

1. Check for large backup sources
2. Review compression settings
3. Consider increasing poll interval
4. Check for file permission issues causing repeated retries

## Manual Testing

Before installing as a service, test the daemon mode manually:

```bash
# Run daemon in foreground (Ctrl+C to stop)
node src/daemon.js

# Or with debug logging
LOG_LEVEL=debug node src/daemon.js
```

This lets you see output and errors directly without checking log files.

## Reverting to Cron

If you prefer cron/scheduled tasks instead of a continuous daemon:

1. Uninstall the service (see platform-specific uninstall instructions)
2. Use cron (macOS/Linux) or Task Scheduler (Windows) to run:
   ```
   node /path/to/agent/src/index.js
   ```

The one-shot mode (`index.js`) runs a single backup cycle and exits, while daemon mode (`daemon.js`) runs continuously.
