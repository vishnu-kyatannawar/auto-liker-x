#!/bin/bash

# Script to set up systemd service and timer for LinkedIn bot

echo "Setting up LinkedIn Bot systemd service..."

# Copy service files to systemd directory
sudo cp linkedin-bot.service /etc/systemd/system/
sudo cp linkedin-bot.timer /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable and start the timer
sudo systemctl enable linkedin-bot.timer
sudo systemctl start linkedin-bot.timer

echo "✓ LinkedIn Bot timer installed and started"
echo ""
echo "Useful commands:"
echo "  Check timer status:  sudo systemctl status linkedin-bot.timer"
echo "  Check service logs:  sudo journalctl -u linkedin-bot.service -f"
echo "  Run manually now:    sudo systemctl start linkedin-bot.service"
echo "  Stop timer:          sudo systemctl stop linkedin-bot.timer"
echo "  Disable timer:       sudo systemctl disable linkedin-bot.timer"
