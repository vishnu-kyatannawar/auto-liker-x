# LinkedIn Posts Liker & Resharer

Automated tool to monitor LinkedIn pages, like new posts, and reshare them automatically.

## Features

- Monitors multiple LinkedIn company/personal pages
- Automatically likes new posts
- Automatically reshares new posts
- Tracks processed posts to avoid duplicates
- Runs on a configurable schedule
- Headless browser automation using Playwright
- Persistent browser session - login once, no repeated verification

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
```

**Environment Variables:**
- `LINKEDIN_EMAIL` - Your LinkedIn email
- `LINKEDIN_PASSWORD` - Your LinkedIn password
- `CHECK_INTERVAL_MINUTES` - How often to check for new posts (default: 60)
- `LINKEDIN_PAGES` - Comma-separated list of LinkedIn pages to monitor
- `HEADLESS` - Set to `true` to run browser in background, `false` to see browser window

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
2. Checks if already logged in, if not, logs in using your credentials
3. On first login, waits for you to complete any verification manually
4. Visits each page in your config
5. Finds all posts on the page
6. For each new post (not previously processed):
   - Clicks the "Like" button
   - Clicks "Repost" to reshare
   - Saves the post ID to avoid processing again
7. Waits for the configured interval
8. Repeats (using saved session, no re-login needed)

## Notes

- **Session Persistence**: Your login session is saved in `.browser-data/` folder. After first successful login, you won't need to login again
- **Browser Mode**: Set `HEADLESS=false` in `.env` to see the browser, or `HEADLESS=true` to run in background
- **Post Tracking**: Posts are tracked in `processed-posts.json` to avoid duplicate actions
- **Rate Limiting**: The tool includes delays between actions to avoid LinkedIn rate limits
- **First Run**: LinkedIn may require verification on first login - complete it manually in the browser window

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
