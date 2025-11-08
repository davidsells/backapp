#!/bin/bash
#
# Linux Systemd Service Uninstallation Script
#

set -e

echo "BackApp Agent - Linux Service Uninstallation"
echo "=============================================="
echo ""

HOME_DIR="$HOME"
SERVICE_FILE="$HOME_DIR/.config/systemd/user/backapp-agent.service"

if [ ! -f "$SERVICE_FILE" ]; then
    echo "Service not installed (service file not found)"
    exit 0
fi

echo "Stopping service..."
systemctl --user stop backapp-agent.service 2>/dev/null || true

echo "Disabling service..."
systemctl --user disable backapp-agent.service 2>/dev/null || true

echo "Removing service file..."
rm -f "$SERVICE_FILE"

echo "Reloading systemd..."
systemctl --user daemon-reload

echo ""
echo "✓ BackApp Agent uninstalled successfully!"
echo ""
echo "Note: Logs are preserved in journald. View with:"
echo "  journalctl --user -u backapp-agent"
echo ""
