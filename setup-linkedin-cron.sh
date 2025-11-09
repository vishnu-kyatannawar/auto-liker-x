#!/bin/bash

# Script to set up cron job for LinkedIn bot only

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Setting up cron job for LinkedIn Bot only..."

# Find npm location
NPM_PATH=$(which npm)
if [ -z "$NPM_PATH" ]; then
    echo "Error: npm not found in PATH"
    exit 1
fi

echo "Found npm at: $NPM_PATH"

# Make sure RUN_ONCE is set in .env
if ! grep -q "^RUN_ONCE=" "$SCRIPT_DIR/.env" 2>/dev/null; then
    echo "RUN_ONCE=true" >> "$SCRIPT_DIR/.env"
    echo "Added RUN_ONCE=true to .env"
fi

# Use the wrapper script that handles environment setup
WRAPPER_SCRIPT="$SCRIPT_DIR/run-bot.sh"

# Make sure wrapper script is executable
chmod +x "$WRAPPER_SCRIPT"

echo "Creating cron jobs using wrapper script: $WRAPPER_SCRIPT linkedin"

# Create cron job that runs every hour for LinkedIn
(crontab -l 2>/dev/null; echo "0 * * * * $WRAPPER_SCRIPT linkedin >> $SCRIPT_DIR/linkedin-cron.log 2>&1") | crontab -

# Also add @reboot to run on startup (5 min after boot)
(crontab -l 2>/dev/null; echo "@reboot sleep 300 && $WRAPPER_SCRIPT linkedin >> $SCRIPT_DIR/linkedin-cron.log 2>&1") | crontab -

echo "✓ LinkedIn cron job installed"
echo ""
echo "The LinkedIn bot will run:"
echo "  - Every hour (at the top of each hour)"
echo "  - 5 minutes after system reboot"
echo ""
echo "View cron jobs:  crontab -l"
echo "View logs:       tail -f $SCRIPT_DIR/linkedin-cron.log"
echo "Remove cron:     crontab -e (then delete the lines)"

