# LinkedIn Posts Liker

Automated tool to monitor LinkedIn pages and automatically like new posts.

## Features

- Monitors multiple LinkedIn company/personal pages
- Automatically likes new posts
- Finds last liked post and processes only newer posts
- Processes posts from oldest to newest
- Tracks processed posts to avoid duplicates
- Runs on a configurable schedule
- Headless browser automation using Playwright
- Persistent browser session - login once, no repeated verification
- Detailed summary report after each run

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

Copy `.env.example` to `.env` and fill in your LinkedIn credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password
CHECK_INTERVAL_MINUTES=60
LINKEDIN_PAGES=https://www.linkedin.com/company/your-company/,https://www.linkedin.com/in/some-person/
HEADLESS=false
CSV_LOG_PATH=./logs/linkedin-bot-results.csv
```

**Environment Variables:**
- `LINKEDIN_EMAIL` - Your LinkedIn email
- `LINKEDIN_PASSWORD` - Your LinkedIn password
- `CHECK_INTERVAL_MINUTES` - How often to check for new posts (default: 60)
- `LINKEDIN_PAGES` - Comma-separated list of LinkedIn pages to monitor
- `HEADLESS` - Set to `true` to run browser in background, `false` to see browser window
- `CSV_LOG_PATH` - Path to CSV log file for tracking results (default: ./linkedin-bot-results.csv)

## Usage

### First Run (One-time Setup)

On your first run, you'll need to complete LinkedIn verification:

```bash
npm start
```

1. The browser window will open
2. If LinkedIn asks for verification (email code, phone, etc.), complete it manually in the browser
3. Once verified, the session is saved in `.browser-data/` folder
4. Future runs will skip login and verification automatically

### Subsequent Runs

After first-time setup, just run:

```bash
npm start
```

The bot will:
- Use saved session (no login needed)
- Check all configured pages
- Continue running and check at your configured interval

### Development Mode

```bash
npm run dev
```

Runs with auto-restart on file changes.

## How It Works

1. Launches browser with persistent session (saved in `.browser-data/`)
2. Logs in to LinkedIn (or restores existing session)
3. On first login, waits for you to complete any verification manually
4. Visits each configured LinkedIn page
5. Sorts posts by "Recent"
6. Scrolls down to find the last post you already liked
7. Processes all posts above that (newer posts) from oldest to newest:
   - Clicks the "Like" button
   - Saves the post ID to avoid processing again
8. Shows detailed summary (total posts, successful likes, failures)
9. Waits for the configured interval
10. Repeats (using saved session, no re-login needed)

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

- **Session Persistence**: Your login session is saved in `.browser-data/` folder. After first successful login, you won't need to login again
- **Browser Mode**: Set `HEADLESS=false` in `.env` to see the browser, or `HEADLESS=true` to run in background
- **Post Tracking**: Posts are tracked in `processed-posts.json` to avoid duplicate actions
- **Rate Limiting**: The tool includes delays between actions to avoid LinkedIn rate limits
- **First Run**: LinkedIn may require verification on first login - complete it manually in the browser window
- **CSV Logs**: All results are logged to CSV with IST timestamps for easy tracking and analysis

## Troubleshooting

**Login fails**: Check your credentials in `.env` file

**Verification required**: On first run, complete the verification manually in the browser window. The session will be saved for future runs.

**Session expired**: Delete the `.browser-data/` folder and run again to create a fresh session

**Rate limited**: Increase delays in the code or reduce check frequency

**Posts not found**: LinkedIn's DOM structure may have changed; selectors may need updating

**Reset everything**: Delete both `.browser-data/` and `processed-posts.json` to start fresh

## Safety

- Only use this for your own content or pages you manage
- Be aware of LinkedIn's Terms of Service
- Use reasonable check intervals to avoid excessive automation
