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

# Release Notes - v2.0.0

**Release Date:** December 15, 2025

## 🎉 Major Release: AppImage Support

This release introduces **standalone AppImage distribution**, making it easier than ever to deploy and run the bots without any system dependencies. No Node.js installation, no npm dependencies, no Playwright setup - just download and run!

## ✨ New Features

### 🚀 AppImage Distribution (Major Feature)
- **Self-Contained Executables**: Each bot is now available as a single AppImage file
  - `linkedin-bot.AppImage` - Standalone LinkedIn bot
  - `instagram-bot.AppImage` - Standalone Instagram bot
- **Zero Dependencies**: Includes everything needed to run:
  - Node.js runtime (~50MB)
  - All npm dependencies (~50-100MB)
  - Playwright Chromium browser (~150-200MB)
  - Application code
- **Portable**: Run from any directory, reads `.env` from current directory
- **Easy Deployment**: Just copy the AppImage file and `.env` to any Linux system
- **Build Scripts**: New npm commands for building AppImages:
  ```bash
  npm run build:appimage:linkedin    # Build LinkedIn bot AppImage
  npm run build:appimage:instagram   # Build Instagram bot AppImage
  npm run build:appimage:all         # Build both AppImages
  ```

### 📊 Unified CSV Logging
- **Single Log File**: Both LinkedIn and Instagram now log to the same CSV file
- **Platform Column**: Added "Platform" column to distinguish entries
- **Simplified Configuration**: One `CSV_LOG_PATH` environment variable for both platforms
- **Default Path**: `./bot-results.csv` (configurable via `CSV_LOG_PATH`)
- **Backward Compatible**: Existing separate log files still work

## 🔧 Improvements

### Build System
- **Automated Icon Creation**: Build script automatically creates placeholder icons
- **Auto Cleanup**: Build process automatically removes all temporary files
- **Better Error Handling**: Improved build process with proper error checking
- **Gitignore Updates**: Build artifacts automatically excluded from git

### TypeScript Configuration
- **DOM Types**: Added DOM library support for browser API usage
- **Better Type Safety**: Improved compilation with proper type definitions

## 📦 Installation & Usage

### Traditional Installation (Still Supported)
```bash
npm install
npm run install-browser
# Configure .env and run as before
```

### AppImage Installation (New!)
```bash
# 1. Download or build the AppImage
npm run build:appimage:linkedin

# 2. Create .env file in your desired directory
cp .env.example .env
# Edit .env with your credentials

# 3. Make AppImage executable (if needed)
chmod +x linkedin-bot.AppImage

# 4. Run it!
./linkedin-bot.AppImage
```

## 🎯 Use Cases for AppImage

- **No-Install Deployment**: Run on systems without Node.js
- **Portable Distribution**: Copy to USB drive, run anywhere
- **CI/CD Integration**: Easy deployment in automated systems
- **Multi-System Usage**: Same AppImage works across different Linux distributions
- **Clean Separation**: Keep bot isolated from system dependencies

## 📝 Technical Details

### AppImage Structure
- **Size**: ~250-350MB per AppImage (includes all dependencies)
- **Format**: Standard AppImage format (squashfs-based)
- **Architecture**: x86_64 Linux
- **Desktop Integration**: Includes desktop entry files
- **Environment**: Reads `.env` from current working directory

### Build Process
- Downloads Node.js LTS runtime
- Installs production dependencies
- Compiles TypeScript to JavaScript
- Bundles Playwright Chromium browser
- Creates AppDir structure
- Packages as AppImage using appimagetool
- Auto-cleans temporary files

## 🔄 Migration Guide

### From v1.0.0 to v2.0.0

**No Breaking Changes!** All existing functionality remains the same.

**CSV Logging Changes:**
- If you were using separate log files, they'll now be unified
- Update your scripts if they reference `linkedin-bot-results.csv` or `instagram-bot-results.csv`
- New default: `bot-results.csv` (both platforms)

**New Optional Feature:**
- AppImage builds are optional - existing npm-based workflow still works
- Use AppImages if you want standalone distribution
- Continue using npm scripts if you prefer traditional installation

## 🐛 Bug Fixes

- Fixed TypeScript compilation errors with DOM APIs
- Fixed Playwright browser installation in build process
- Fixed appimagetool download URL
- Improved build script error handling

## 📊 File Structure Changes

**New Files:**
- `build-appimage.sh` - Main AppImage build script
- `build-linkedin-appimage.sh` - LinkedIn-specific build wrapper
- `build-instagram-appimage.sh` - Instagram-specific build wrapper
- `.appimageignore` - Files to exclude from AppImage

**Updated Files:**
- `package.json` - Added AppImage build scripts
- `tsconfig.json` - Added DOM types
- `.gitignore` - Excludes build artifacts

## ⚠️ Important Notes

1. **AppImage Size**: Each AppImage is ~250-350MB (includes everything)
2. **First Run**: Still requires manual 2FA verification on first login
3. **Browser Data**: Session data created in current directory (`.browser-data/`, `.browser-data-instagram/`)
4. **CSV Logs**: Now unified in single file by default
5. **Linux Only**: AppImages are Linux-specific (x86_64)

## 🔒 Security

- AppImages are self-contained and don't modify system files
- All credentials still read from `.env` file
- Session data stored locally in current directory
- No network communication except to LinkedIn/Instagram

## 🙏 Acknowledgments

This release adds significant distribution capabilities while maintaining all existing functionality. The AppImage format makes deployment easier for users who don't want to manage Node.js installations.

---

**Version**: 2.0.0  
**Release Date**: December 15, 2025  
**License**: ISC  
**Platform Support**: Linux (AppImage), Linux/macOS (npm installation)

For detailed setup instructions, see [README.md](README.md)

