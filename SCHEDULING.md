# Scheduling Guide

This guide explains how to set up the LinkedIn bot to run automatically, even after system reboots.

## Prerequisites

1. Make sure you've completed first-time setup:
   ```bash
   npm install
   npm run install-browser
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. Test run manually to ensure everything works:
   ```bash
   npm start
   ```

3. **Important**: Set `HEADLESS=true` in `.env` for scheduled runs

## Option 1: Systemd Service (Recommended for Linux)

Best for: Ubuntu, Debian, Fedora, most modern Linux distributions

### Installation

```bash
./setup-systemd.sh
```

### What it does
- Runs the bot once daily at midnight
- Automatically starts 5 minutes after system reboot
- Runs in the background
- Logs to system journal

### Useful Commands

```bash
# Check timer status
sudo systemctl status linkedin-bot.timer

# View logs
sudo journalctl -u linkedin-bot.service -f

# Run manually now
sudo systemctl start linkedin-bot.service

# Stop the timer
sudo systemctl stop linkedin-bot.timer

# Disable automatic running
sudo systemctl disable linkedin-bot.timer

# Re-enable after changes
sudo systemctl daemon-reload
sudo systemctl restart linkedin-bot.timer
```

### Customizing Schedule

Edit `/etc/systemd/system/linkedin-bot.timer` and change the `OnCalendar` line:

```ini
# Daily at 9 AM
OnCalendar=*-*-* 09:00:00

# Every 6 hours
OnCalendar=00/6:00:00

# Weekdays at 8 AM
OnCalendar=Mon-Fri *-*-* 08:00:00
```

Then reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart linkedin-bot.timer
```

## Option 2: Cron Job (Simple Alternative)

Best for: Any Unix-like system, simpler setup

### Installation

```bash
./setup-cron.sh
```

### What it does
- Runs daily at 9:00 AM
- Runs 5 minutes after system reboot
- Logs to `cron.log` in project directory

### Useful Commands

```bash
# View installed cron jobs
crontab -l

# Edit cron jobs
crontab -e

# View logs
tail -f /home/vishnu/projects/research/playwright/linkedin-posts-liker/cron.log

# Remove cron jobs
crontab -e
# Then delete the linkedin-bot lines
```

### Customizing Schedule

Edit cron with `crontab -e` and modify the time:

```bash
# Format: minute hour day month weekday command

# Daily at 10 AM
0 10 * * * cd /path/to/project && npm start

# Every 12 hours
0 */12 * * * cd /path/to/project && npm start

# Weekdays at 9 AM
0 9 * * 1-5 cd /path/to/project && npm start
```

## Option 3: PM2 Process Manager (Advanced)

Best for: Always running with automatic restart

### Installation

```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start npm --name "linkedin-bot" -- start

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Follow the command it prints
```

### Useful Commands

```bash
# View status
pm2 status

# View logs
pm2 logs linkedin-bot

# Restart
pm2 restart linkedin-bot

# Stop
pm2 stop linkedin-bot

# Remove
pm2 delete linkedin-bot
```

## Option 4: Manual with Screen (Temporary)

For testing or temporary use:

```bash
# Start a screen session
screen -S linkedin-bot

# Run the bot
npm start

# Detach from screen: Press Ctrl+A, then D

# Reattach later
screen -r linkedin-bot

# Kill session
screen -X -S linkedin-bot quit
```

## Troubleshooting

### Bot not running after reboot

**Systemd:**
```bash
sudo systemctl status linkedin-bot.timer
sudo journalctl -u linkedin-bot.service -n 50
```

**Cron:**
```bash
crontab -l  # Verify cron is installed
tail -f cron.log  # Check logs
```

### Headless mode issues

Make sure `HEADLESS=true` in `.env` for scheduled runs. The browser can't show a window when running as a service.

### Permission errors

Systemd runs as your user, but make sure:
```bash
# Check file permissions
ls -la /home/vishnu/projects/research/playwright/linkedin-posts-liker/

# Files should be owned by vishnu
sudo chown -R vishnu:vishnu /home/vishnu/projects/research/playwright/linkedin-posts-liker/
```

### Network not ready

If the bot fails immediately after boot, the network might not be ready. The systemd service includes `After=network-online.target` to wait for network.

For cron, the 5-minute sleep should be sufficient.

## Monitoring

### Check CSV logs

```bash
cat /home/vishnu/linkedin-bot-results.csv
```

### Set up email alerts (optional)

Install mail utilities:
```bash
sudo apt install mailutils
```

Add to cron:
```bash
0 9 * * * cd /path/to/project && npm start 2>&1 | mail -s "LinkedIn Bot Report" your-email@example.com
```

## Best Practices

1. **Start with cron** for simplicity
2. **Use systemd** for production reliability
3. **Always set HEADLESS=true** for scheduled runs
4. **Monitor CSV logs** regularly
5. **Test manually first** before scheduling
6. **Set reasonable intervals** (daily is usually sufficient)

## Uninstalling

**Systemd:**
```bash
sudo systemctl stop linkedin-bot.timer
sudo systemctl disable linkedin-bot.timer
sudo rm /etc/systemd/system/linkedin-bot.{service,timer}
sudo systemctl daemon-reload
```

**Cron:**
```bash
crontab -e
# Delete the linkedin-bot lines
```

**PM2:**
```bash
pm2 delete linkedin-bot
pm2 save
```
