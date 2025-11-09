# Release Notes - v1.0.0

**Release Date:** November 9, 2025

## 🎉 Initial Release

This is the first stable release of the LinkedIn & Instagram Auto-Liker bot, a powerful automation tool for managing social media engagement across multiple platforms.

## ✨ Major Features

### Dual Platform Support
- **LinkedIn Integration**: Automatically like new posts from configured company/personal pages
- **Instagram Integration**: Automatically like new posts from configured accounts
- **Unified Management**: Run both platforms together or independently

### Intelligent Liking Strategy
- **Smart Detection**: Finds the last liked post and processes only newer content
- **Two-Phase Approach** (Instagram):
  - Phase 1: Navigate forward to find 3 consecutive liked posts (confirms previous session end)
  - Phase 2: Navigate backward, liking all new posts until reaching the newest
- **No Duplicates**: Uses platform's native like status (no local storage needed)
- **Automatic Stopping**: Stops when reaching previously processed content

### Session Management
- **Persistent Sessions**: Login once, reuse sessions indefinitely
- **Automatic 2FA Handling**: Detects verification requests and waits for manual completion
- **Separate Storage**: LinkedIn (`.browser-data/`) and Instagram (`.browser-data-instagram/`)
- **"Save Login Info" Support**: Automatically clicks save buttons to persist sessions

### Flexible Execution Modes

#### Manual Execution
```bash
./run-bot.sh              # Run both bots sequentially
./run-bot.sh linkedin     # Run LinkedIn only
./run-bot.sh instagram    # Run Instagram only
```

#### Automated Scheduling (Cron)
```bash
./setup-both-cron.sh          # Schedule both bots
./setup-linkedin-cron.sh      # Schedule LinkedIn only
./setup-instagram-cron.sh     # Schedule Instagram only
```

### Comprehensive Logging
- **CSV Logs**: Detailed results with IST timestamps
  - `linkedin-bot-results.csv` - LinkedIn results
  - `instagram-bot-results.csv` - Instagram results
- **Cron Logs**: Execution logs for scheduled runs
  - `both-bots-cron.log` - Both bots
  - `linkedin-cron.log` - LinkedIn only
  - `instagram-cron.log` - Instagram only
- **Tracked Metrics**: New posts found, successful likes, failures, status, errors

### Robust Error Handling
- Page load timeout handling
- Network error recovery
- Failed like attempt tracking
- Comprehensive error logging
- Exit code reporting

## 🚀 Key Capabilities

### LinkedIn Bot
- Monitors multiple company/personal pages
- Sorts posts by "Recent"
- Scrolls to find last liked post
- Processes all newer posts from top to bottom
- Respects rate limits with built-in delays

### Instagram Bot
- Monitors multiple user accounts
- Opens posts in modal view
- Navigates using Next/Back buttons
- Detects liked posts via SVG aria-labels
- Two-phase verification (3 consecutive liked posts)
- Smart backward navigation for liking

## 📦 Installation

```bash
# Clone repository
git clone <repository-url>
cd linkedin-posts-liker

# Install dependencies
npm install

# Install browser
npm run install-browser

# Configure
cp .env.example .env
# Edit .env with your credentials
```

## 🔧 Configuration

### Required Environment Variables

**LinkedIn:**
- `LINKEDIN_EMAIL` - Your LinkedIn email
- `LINKEDIN_PASSWORD` - Your LinkedIn password
- `LINKEDIN_PAGES` - Comma-separated page URLs

**Instagram:**
- `INSTAGRAM_USERNAME` - Your Instagram username
- `INSTAGRAM_PASSWORD` - Your Instagram password
- `INSTAGRAM_ACCOUNTS` - Comma-separated account URLs

**General:**
- `CHECK_INTERVAL_MINUTES` - Check frequency (default: 60)
- `HEADLESS` - Run in background (true/false)
- `RUN_ONCE` - Single run mode for cron (true/false)

## 📊 Usage Statistics

The bots provide detailed summaries after each run:
- Total posts checked
- New posts found
- Successfully liked posts
- Failed/skipped posts
- Execution status (SUCCESS/PARTIAL/ERROR/TIMEOUT)

## 🛡️ Safety Features

- Rate limiting delays between actions
- Headless mode for automated runs
- Session persistence to reduce login frequency
- Graceful error handling and recovery
- Configurable check intervals

## 🔒 Security

- Environment variables for credentials
- Local session storage (not committed to git)
- Browser data directories in `.gitignore`
- No credential logging

## 📝 Technical Details

- **Language**: TypeScript
- **Runtime**: Node.js
- **Browser Automation**: Playwright
- **Session Storage**: Chromium persistent context
- **Logging**: CSV format with timestamps (IST)
- **Scheduling**: Cron-based (hourly execution)

## 🎯 Use Cases

- Stay engaged with industry thought leaders
- Support your network's content
- Maintain presence on multiple platforms
- Automate routine engagement tasks
- Monitor and engage with specific accounts

## ⚠️ Important Notes

1. **First Run**: Complete 2FA verification manually in browser window
2. **Headless Mode**: Required for scheduled/automated runs
3. **Rate Limits**: Built-in delays help avoid platform rate limiting
4. **Terms of Service**: Use responsibly and be aware of platform ToS
5. **Manual Verification**: May be required periodically

## 🐛 Known Limitations

- Requires stable internet connection
- Platform DOM changes may require selector updates
- 2FA must be completed manually on first run or after session expiry
- Maximum 50 posts checked per run (safety limit)

## 🔄 Upgrade Path

This is the initial release. Future updates will maintain backward compatibility with configuration files.

## 📞 Support

- GitHub Issues: Report bugs and request features
- Documentation: See README.md for detailed setup instructions
- Configuration: See .env.example for all available options

## 🙏 Acknowledgments

Built with:
- Playwright for browser automation
- TypeScript for type safety
- Node.js for runtime environment

---

**Version**: 1.0.0  
**Release Date**: November 9, 2025  
**License**: ISC  
**Platform Support**: Linux, macOS (Windows support not tested)

For detailed setup instructions, see [README.md](README.md)

