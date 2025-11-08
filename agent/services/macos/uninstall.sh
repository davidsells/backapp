#!/bin/bash
#
# macOS LaunchAgent Uninstallation Script
#

set -e

echo "BackApp Agent - macOS Service Uninstallation"
echo "============================================="
echo ""

HOME_DIR="$HOME"
PLIST_FILE="$HOME_DIR/Library/LaunchAgents/com.backapp.agent.plist"

if [ ! -f "$PLIST_FILE" ]; then
    echo "Service not installed (plist file not found)"
    exit 0
fi

echo "Stopping service..."
launchctl unload "$PLIST_FILE" 2>/dev/null || true

echo "Removing service file..."
rm -f "$PLIST_FILE"

echo ""
echo "✓ BackApp Agent uninstalled successfully!"
echo ""
echo "Note: Log files have been preserved at:"
echo "  $HOME_DIR/Library/Logs/backapp-agent.log"
echo "  $HOME_DIR/Library/Logs/backapp-agent-error.log"
echo ""
