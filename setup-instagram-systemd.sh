#!/bin/bash

# Script to set up systemd service and timer for Instagram bot

echo "Setting up Instagram Bot systemd service..."

# Copy service files to systemd directory
sudo cp instagram-bot.service /etc/systemd/system/
sudo cp instagram-bot.timer /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable and start the timer
sudo systemctl enable instagram-bot.timer
sudo systemctl start instagram-bot.timer

echo "✓ Instagram Bot timer installed and started"
echo ""
echo "Useful commands:"
echo "  Check timer status:  sudo systemctl status instagram-bot.timer"
echo "  Check service logs:  sudo journalctl -u instagram-bot.service -f"
echo "  Run manually now:    sudo systemctl start instagram-bot.service"
echo "  Stop timer:          sudo systemctl stop instagram-bot.timer"
echo "  Disable timer:       sudo systemctl disable instagram-bot.timer"


