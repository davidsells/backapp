#!/bin/bash
#
# macOS LaunchAgent Installation Script
# Installs BackApp Agent as a user-level LaunchAgent
#

set -e

echo "BackApp Agent - macOS Service Installation"
echo "==========================================="
echo ""

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
AGENT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Get username
USERNAME=$(whoami)
HOME_DIR="$HOME"

# Detect node path
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo "Error: Node.js not found in PATH"
    echo "Please install Node.js first or add it to your PATH"
    exit 1
fi

echo "Detected Node.js: $NODE_PATH"
echo "Agent directory: $AGENT_DIR"
echo "User: $USERNAME"
echo ""

# Create plist file
PLIST_FILE="$HOME_DIR/Library/LaunchAgents/com.backapp.agent.plist"
PLIST_DIR="$(dirname "$PLIST_FILE")"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$PLIST_DIR"

echo "Creating service file: $PLIST_FILE"

# Generate plist with actual paths
cat > "$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.backapp.agent</string>

    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$AGENT_DIR/src/daemon.js</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$AGENT_DIR</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>$HOME_DIR/Library/Logs/backapp-agent.log</string>

    <key>StandardErrorPath</key>
    <string>$HOME_DIR/Library/Logs/backapp-agent-error.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$(dirname $NODE_PATH)</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>

    <key>ThrottleInterval</key>
    <integer>60</integer>

    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
EOF

echo "Service file created successfully"
echo ""

# Load the service
echo "Loading service..."
launchctl load "$PLIST_FILE"

echo ""
echo "✓ BackApp Agent installed successfully!"
echo ""
echo "Service status:"
launchctl list | grep backapp || echo "  (Service will start shortly)"
echo ""
echo "Log files:"
echo "  Output: $HOME_DIR/Library/Logs/backapp-agent.log"
echo "  Errors: $HOME_DIR/Library/Logs/backapp-agent-error.log"
echo ""
echo "Useful commands:"
echo "  Start:   launchctl load $PLIST_FILE"
echo "  Stop:    launchctl unload $PLIST_FILE"
echo "  Status:  launchctl list | grep backapp"
echo "  Logs:    tail -f $HOME_DIR/Library/Logs/backapp-agent.log"
echo ""
