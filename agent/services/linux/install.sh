#!/bin/bash
#
# Linux Systemd Service Installation Script
# Installs BackApp Agent as a user-level systemd service
#

set -e

echo "BackApp Agent - Linux Service Installation"
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

# Create systemd user directory
SYSTEMD_DIR="$HOME_DIR/.config/systemd/user"
mkdir -p "$SYSTEMD_DIR"

SERVICE_FILE="$SYSTEMD_DIR/backapp-agent.service"

echo "Creating service file: $SERVICE_FILE"

# Generate service file with actual paths
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=BackApp Agent - Automated Backup Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple

# Working directory
WorkingDirectory=$AGENT_DIR

# Command to run
ExecStart=$NODE_PATH $AGENT_DIR/src/daemon.js

# Restart policy
Restart=on-failure
RestartSec=60

# Environment
Environment="NODE_ENV=production"
Environment="PATH=/usr/local/bin:/usr/bin:/bin:$(dirname $NODE_PATH)"

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=backapp-agent

# Security settings
NoNewPrivileges=true
PrivateTmp=true

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=default.target
EOF

echo "Service file created successfully"
echo ""

# Reload systemd
echo "Reloading systemd..."
systemctl --user daemon-reload

# Enable service
echo "Enabling service..."
systemctl --user enable backapp-agent.service

# Start service
echo "Starting service..."
systemctl --user start backapp-agent.service

echo ""
echo "✓ BackApp Agent installed successfully!"
echo ""
echo "Service status:"
systemctl --user status backapp-agent.service --no-pager || true
echo ""
echo "Useful commands:"
echo "  Start:   systemctl --user start backapp-agent"
echo "  Stop:    systemctl --user stop backapp-agent"
echo "  Restart: systemctl --user restart backapp-agent"
echo "  Status:  systemctl --user status backapp-agent"
echo "  Logs:    journalctl --user -u backapp-agent -f"
echo "  Enable:  systemctl --user enable backapp-agent  (start on login)"
echo "  Disable: systemctl --user disable backapp-agent"
echo ""
echo "Note: User services start when you log in and stop when you log out."
echo "To keep the service running even when logged out, enable lingering:"
echo "  sudo loginctl enable-linger $USERNAME"
echo ""
