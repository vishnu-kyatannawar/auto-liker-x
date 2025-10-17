#!/bin/bash

# Script to set up cron job for LinkedIn bot

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Setting up cron job for LinkedIn Bot..."

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

# Get the PATH that includes npm (including nvm paths)
SHELL_PATH="$PATH"

# Check if using nvm and get nvm directory
NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    echo "Detected nvm installation"
    # Create cron jobs that source nvm before running
    (crontab -l 2>/dev/null; echo "0 * * * * . $NVM_DIR/nvm.sh && cd $SCRIPT_DIR && npm start >> $SCRIPT_DIR/cron.log 2>&1") | crontab -
    (crontab -l 2>/dev/null; echo "@reboot sleep 300 && . $NVM_DIR/nvm.sh && cd $SCRIPT_DIR && npm start >> $SCRIPT_DIR/cron.log 2>&1") | crontab -
else
    # Not using nvm, use regular PATH
    (crontab -l 2>/dev/null; echo "0 * * * * export PATH=\"$SHELL_PATH\" && cd $SCRIPT_DIR && npm start >> $SCRIPT_DIR/cron.log 2>&1") | crontab -
    (crontab -l 2>/dev/null; echo "@reboot sleep 300 && export PATH=\"$SHELL_PATH\" && cd $SCRIPT_DIR && npm start >> $SCRIPT_DIR/cron.log 2>&1") | crontab -
fi

echo "✓ Cron job installed"
echo ""
echo "The bot will run:"
echo "  - Every hour (at the top of each hour)"
echo "  - 5 minutes after system reboot"
echo ""
echo "View cron jobs:  crontab -l"
echo "View logs:       tail -f $SCRIPT_DIR/cron.log"
echo "Remove cron:     crontab -e (then delete the lines)"
