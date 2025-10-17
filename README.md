# LinkedIn Posts Liker & Resharer

Automated tool to monitor LinkedIn pages, like new posts, and reshare them automatically.

## Features

- Monitors multiple LinkedIn company/personal pages
- Automatically likes new posts
- Automatically reshares new posts
- Tracks processed posts to avoid duplicates
- Runs on a configurable schedule
- Headless browser automation using Playwright

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
```

### 4. Configure Pages to Monitor

Edit `config.json` and add the LinkedIn pages you want to monitor:

```json
{
  "pages": [
    "https://www.linkedin.com/company/your-company/",
    "https://www.linkedin.com/in/some-person/"
  ],
  "checkIntervalMinutes": 60
}
```

## Usage

### Run Once

```bash
npm start
```

This will check all configured pages once, then continue running and check every hour (or your configured interval).

### Development Mode

```bash
npm run dev
```

Runs with auto-restart on file changes.

## How It Works

1. Logs into LinkedIn using your credentials
2. Visits each page in your config
3. Finds all posts on the page
4. For each new post (not previously processed):
   - Clicks the "Like" button
   - Clicks "Repost" to reshare
   - Saves the post ID to avoid processing again
5. Waits for the configured interval
6. Repeats

## Notes

- The browser runs in non-headless mode by default so you can see what's happening
- Set `headless: true` in `src/linkedin.ts` for production use
- Posts are tracked in `processed-posts.json` to avoid duplicate actions
- The tool includes delays between actions to avoid rate limiting
- LinkedIn may require manual verification on first login

## Troubleshooting

**Login fails**: Check your credentials in `.env` file

**Verification required**: Run the script and complete the verification manually in the browser window

**Rate limited**: Increase delays in the code or reduce check frequency

**Posts not found**: LinkedIn's DOM structure may have changed; selectors may need updating

## Safety

- Only use this for your own content or pages you manage
- Be aware of LinkedIn's Terms of Service
- Use reasonable check intervals to avoid excessive automation
