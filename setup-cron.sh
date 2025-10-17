#!/bin/bash

# Script to set up cron job for LinkedIn bot

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Setting up cron job for LinkedIn Bot..."

# Create a cron job that runs daily at 9 AM
(crontab -l 2>/dev/null; echo "0 9 * * * cd $SCRIPT_DIR && /usr/bin/npm start >> $SCRIPT_DIR/cron.log 2>&1") | crontab -

# Also add @reboot to run on startup (5 min after boot)
(crontab -l 2>/dev/null; echo "@reboot sleep 300 && cd $SCRIPT_DIR && /usr/bin/npm start >> $SCRIPT_DIR/cron.log 2>&1") | crontab -

echo "✓ Cron job installed"
echo ""
echo "The bot will run:"
echo "  - Daily at 9:00 AM"
echo "  - 5 minutes after system reboot"
echo ""
echo "View cron jobs:  crontab -l"
echo "View logs:       tail -f $SCRIPT_DIR/cron.log"
echo "Remove cron:     crontab -e (then delete the lines)"
