# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Playwright automation that logs into LinkedIn and Instagram, visits configured pages/accounts, and likes new posts. LinkedIn and Instagram are two independent bots with separate entry points, separate persistent browser sessions, and separate cron schedules — but they share one CSV log file.

## Commands

```bash
npm install                    # install deps
npm run install-browser        # one-time: playwright install chromium

npm start                      # run LinkedIn bot (tsx src/index.ts)
npm run start:instagram        # run Instagram bot (tsx src/index-instagram.ts)
npm run dev                    # LinkedIn with tsx watch
npm run dev:instagram          # Instagram with tsx watch
npm run build                  # tsc -> dist/

./run-bot.sh [linkedin|instagram|both]   # wrapper (sources nvm/.bashrc, used by cron); default: both

npm run build:appimage:linkedin          # standalone AppImage (bundles Node 20 + chromium)
npm run build:appimage:instagram
npm run build:appimage:all
```

No test suite and no linter are configured. There is no single-test command.

Behavior is driven entirely by `.env` (see `.env.example`), not CLI flags. Key vars: `RUN_ONCE` (true = run once and exit, for cron; false = loop every `CHECK_INTERVAL_MINUTES`), `HEADLESS`, `CSV_LOG_PATH`, plus per-platform credentials and the comma-separated `LINKEDIN_PAGES` / `INSTAGRAM_ACCOUNTS` lists.

## Architecture

Five source files in `src/`, structured as two mirror-image bots plus shared logging:

- `index.ts` / `index-instagram.ts` — entry points. Each validates env, parses the page list, then calls its bot in a `runBot` loop. `RUN_ONCE` chooses single-run-then-exit vs. `setInterval` continuous mode. Every page result is written to CSV via the shared logger.
- `linkedin.ts` (`LinkedInBot`) / `instagram.ts` (`InstagramBot`) — the two bot classes. They intentionally do NOT share a base class or interface despite near-identical shape (constructor, `initialize`, `ensureLoggedIn`, `checkPageForNewPosts`, `likePost`, `close`, and a duplicated `PageResult` interface). When changing shared behavior, expect to edit both files.
- `csvLogger.ts` (`CSVLogger`) — the one genuinely shared module. Appends rows with IST timestamps (UTC+5:30, computed by offsetting the Date manually), creates the file+headers and parent dir on construction, and CSV-escapes fields.

### The "no local state" liking strategy

The core trick (both bots): there is no local database of what's been liked. State lives in the platform itself via the like button's pressed state. Each run:

1. Scroll the page loading posts, scanning for the first already-liked post — its unique id (`data-urn` on LinkedIn, the post URL / shortcode on Instagram) marks the boundary.
2. Everything ABOVE that boundary post is "new" and gets processed top-to-bottom; `likePost` re-checks the pressed state and skips anything already liked.
3. If no liked post is ever found, all loaded posts are treated as new.

This makes runs idempotent and stateless, but couples the bots tightly to each platform's DOM: selectors (`div[data-urn*="activity"]`, `button[aria-label*="Like"]` + `aria-pressed`, Instagram's SVG `aria-label` probes) are the most fragile part of the codebase and the first suspect when "posts not found" or nothing gets liked.

### Sessions & login

Each bot uses `chromium.launchPersistentContext` into its own dir — `.browser-data/` (LinkedIn) and `.browser-data-instagram/` (Instagram) — so login/verification happens once and persists. First run (or after deleting the dir) may require manual verification in a non-headless window; the code waits (LinkedIn waits up to 5 min for redirect to `/feed/`). Both dirs are gitignored. Resetting a stuck session = delete the relevant `.browser-data*` dir.

Login is deliberately tolerant: it probes for logged-in indicators first and only fills credentials if needed, then handles checkpoint/verification (LinkedIn) or the onetap "Save info" / notification prompts (Instagram).

### Result status model

`PageResult.status` is derived at the end of each page: `SUCCESS`, `PARTIAL` (some fails but ≥1 success), `ERROR` (all failed, or thrown), or `TIMEOUT` (page navigation timed out). This value flows straight into the CSV `Status` column.

## Scheduling

`setup-*-cron.sh` scripts install crontab entries that invoke `run-bot.sh` (which sources nvm/.bashrc so cron has a working `node`/`npm`). Cron runs assume `RUN_ONCE=true`. `both-bots-cron.log` and `bot-results.csv` are runtime output committed in the repo root.

## Conventions

- Timing is handled with fixed `waitForTimeout` delays throughout (rate-limit avoidance + letting infinite-scroll load) rather than smart waits — intentional, not a bug.
- `strict` TypeScript, run directly via `tsx` (no build step needed for normal use; `dist/` is only for AppImage packaging).
