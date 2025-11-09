# LinkedIn & Instagram Posts Liker

Automated tool to monitor LinkedIn pages and Instagram accounts and automatically like new posts.

## Features

- Monitors multiple LinkedIn company/personal pages and Instagram accounts
- Automatically likes new posts
- Finds last liked post and processes only newer posts
- Uses platform's like status to avoid duplicates (no local storage)
- Runs on a configurable schedule
- Headless browser automation using Playwright
- Persistent browser session - login once, no repeated verification
- Detailed summary report after each run
- CSV logging with IST timestamps
- Separate entry points and scheduling for LinkedIn and Instagram

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browser

```bash
npm run install-browser
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
# LinkedIn Configuration
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password
LINKEDIN_PAGES=https://www.linkedin.com/company/your-company/,https://www.linkedin.com/in/some-person/
CSV_LOG_PATH=./logs/linkedin-bot-results.csv

# Instagram Configuration
INSTAGRAM_USERNAME=your-username
INSTAGRAM_PASSWORD=your-password
INSTAGRAM_ACCOUNTS=https://www.instagram.com/account1/,https://www.instagram.com/account2/
INSTAGRAM_CSV_LOG_PATH=./instagram-bot-results.csv

# General Configuration
CHECK_INTERVAL_MINUTES=60
HEADLESS=false
RUN_ONCE=false
```

**Environment Variables:**

**LinkedIn:**
- `LINKEDIN_EMAIL` - Your LinkedIn email
- `LINKEDIN_PASSWORD` - Your LinkedIn password
- `LINKEDIN_PAGES` - Comma-separated list of LinkedIn pages to monitor
- `CSV_LOG_PATH` - Path to CSV log file for LinkedIn results (default: ./linkedin-bot-results.csv)

**Instagram:**
- `INSTAGRAM_USERNAME` - Your Instagram username
- `INSTAGRAM_PASSWORD` - Your Instagram password
- `INSTAGRAM_ACCOUNTS` - Comma-separated list of Instagram account URLs to monitor
- `INSTAGRAM_CSV_LOG_PATH` - Path to CSV log file for Instagram results (default: ./instagram-bot-results.csv)

**General:**
- `CHECK_INTERVAL_MINUTES` - How often to check for new posts when running continuously (default: 60)
- `HEADLESS` - Set to `true` to run browser in background, `false` to see browser window
- `RUN_ONCE` - Set to `true` to run once and exit (for cron/scheduled runs), `false` for continuous mode (default: false)

## Usage

### LinkedIn Bot

#### First Run (One-time Setup)

On your first run, you'll need to complete LinkedIn verification:

```bash
npm start
```

1. The browser window will open
2. If LinkedIn asks for verification (email code, phone, etc.), complete it manually in the browser
3. Once verified, the session is saved in `.browser-data/` folder
4. Future runs will skip login and verification automatically

#### Subsequent Runs

After first-time setup, just run:

```bash
npm start
```

The bot will:
- Use saved session (no login needed)
- Check all configured LinkedIn pages
- Continue running and check at your configured interval

#### Development Mode

```bash
npm run dev
```

Runs with auto-restart on file changes.

### Instagram Bot

#### First Run (One-time Setup)

On your first run for Instagram:

```bash
npm run start:instagram
```

1. The browser window will open
2. If Instagram asks for verification (email code, phone, etc.), complete it manually in the browser
3. Once verified, the session is saved in `.browser-data-instagram/` folder
4. Future runs will skip login and verification automatically

#### Subsequent Runs

After first-time setup, just run:

```bash
npm run start:instagram
```

The bot will:
- Use saved session (no login needed)
- Check all configured Instagram accounts
- Continue running and check at your configured interval

#### Development Mode

```bash
npm run dev:instagram
```

Runs with auto-restart on file changes.

## Usage

### Manual Execution

Run the bots manually using the wrapper script:

```bash
# Run both bots sequentially (default)
./run-bot.sh

# Run only LinkedIn bot
./run-bot.sh linkedin

# Run only Instagram bot
./run-bot.sh instagram
```

### Automated Scheduling (Cron)

Schedule the bots to run automatically using cron. Choose one of the three options:

#### Option 1: Setup Both Bots (Recommended)
```bash
./setup-both-cron.sh
```
Runs both LinkedIn and Instagram bots sequentially every hour.
Logs to: `both-bots-cron.log`

#### Option 2: Setup LinkedIn Bot Only
```bash
./setup-linkedin-cron.sh
```
Runs only the LinkedIn bot every hour.
Logs to: `linkedin-cron.log`

#### Option 3: Setup Instagram Bot Only
```bash
./setup-instagram-cron.sh
```
Runs only the Instagram bot every hour.
Logs to: `instagram-cron.log`

All scripts will:
- Run hourly (at the top of each hour)
- Run 5 minutes after system reboot
- Create separate log files for easy tracking

#### Manage Cron Jobs

**View scheduled jobs:**
```bash
crontab -l
```

**View logs:**
```bash
tail -f both-bots-cron.log       # Both bots
tail -f linkedin-cron.log         # LinkedIn only
tail -f instagram-cron.log        # Instagram only
```

**Remove cron jobs:**
```bash
crontab -e
# Delete the bot-related lines
```

**Important Configuration:**
- Set `RUN_ONCE=true` in `.env` so scripts run once and exit (cron handles scheduling)
- Set `HEADLESS=true` in `.env` for automated/scheduled runs
- For manual continuous mode, set `RUN_ONCE=false` (script runs continuously with internal interval)

## How It Works

### LinkedIn Bot

1. Launches browser with persistent session (saved in `.browser-data/`)
2. Logs in to LinkedIn (or restores existing session)
3. On first login, waits for you to complete any verification manually
4. Visits each configured LinkedIn page
5. Sorts posts by "Recent"
6. Scrolls down to find the last post you already liked
7. Processes all posts above that (newer posts):
   - Checks if post is already liked (via LinkedIn's UI)
   - Clicks the "Like" button if not already liked
   - Skips if already liked
8. Shows detailed summary (total posts, successful likes, failures)
9. Logs results to CSV with IST timestamp
10. Waits for the configured interval
11. Repeats (using saved session, no re-login needed)

### Instagram Bot

1. Launches browser with persistent session (saved in `.browser-data-instagram/`)
2. Logs in to Instagram (or restores existing session)
3. On first login, waits for you to complete any verification manually
4. Visits each configured Instagram account
5. Opens posts in modal view and navigates through them
6. Finds the last post you already liked by checking heart icon state
7. Processes all posts before that (newer posts):
   - Checks if post is already liked (via Instagram's UI)
   - Clicks the heart icon if not already liked
   - Skips if already liked
8. Shows detailed summary (total posts, successful likes, failures)
9. Logs results to CSV with IST timestamp
10. Waits for the configured interval
11. Repeats (using saved session, no re-login needed)

## CSV Logging

All run results are automatically logged to a CSV file with the following information:
- **Timestamp (IST)** - When the check was performed (Indian Standard Time)
- **Page** - LinkedIn page URL that was checked
- **New Posts Found** - Number of new posts detected
- **Successfully Liked** - Number of posts successfully liked
- **Failed/Skipped** - Number of posts that failed or were skipped
- **Status** - SUCCESS, PARTIAL, ERROR, or TIMEOUT
- **Error Message** - Details if any error occurred

The CSV file is created automatically at the path specified in `CSV_LOG_PATH` environment variable. If the directory doesn't exist, it will be created.

## Notes

- **Session Persistence**: 
  - LinkedIn session is saved in `.browser-data/` folder
  - Instagram session is saved in `.browser-data-instagram/` folder
  - After first successful login, you won't need to login again for each platform
- **Browser Mode**: Set `HEADLESS=false` in `.env` to see the browser, or `HEADLESS=true` to run in background
- **Smart Tracking**: Uses each platform's own like status to track which posts have been liked - no local storage needed
- **Rate Limiting**: The tool includes delays between actions to avoid rate limits
- **First Run**: Both platforms may require verification on first login - complete it manually in the browser window
- **CSV Logs**: All results are logged to separate CSV files with IST timestamps for easy tracking and analysis
- **Independent Operation**: LinkedIn and Instagram bots run independently and can be scheduled separately

## Troubleshooting

**Login fails**: Check your credentials in `.env` file

**Verification required**: On first run, complete the verification manually in the browser window. The session will be saved for future runs.

**Session expired**: 
- For LinkedIn: Delete the `.browser-data/` folder and run again
- For Instagram: Delete the `.browser-data-instagram/` folder and run again

**Rate limited**: Increase delays in the code or reduce check frequency

**Posts not found**: The platform's DOM structure may have changed; selectors may need updating

**Reset session**: 
- For LinkedIn: Delete the `.browser-data/` folder to start with a fresh login
- For Instagram: Delete the `.browser-data-instagram/` folder to start with a fresh login

## Safety

- Only use this for your own content or pages you manage
- Be aware of LinkedIn's and Instagram's Terms of Service
- Use reasonable check intervals to avoid excessive automation
- Automation of social media platforms may violate their terms of service - use at your own risk
