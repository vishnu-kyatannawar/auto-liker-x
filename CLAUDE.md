# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Playwright automation that logs into LinkedIn and Instagram, visits configured pages/accounts, and likes new posts. LinkedIn and Instagram are two independent bots with separate entry points, separate persistent browser sessions, and separate cron schedules — but they share one CSV log file.

## Commands

This project uses **pnpm** (not npm). `pnpm-lock.yaml` is the committed lockfile.

```bash
pnpm install                    # install deps
pnpm run install-browser        # one-time: playwright install chromium (separate from install!)

pnpm start                      # run LinkedIn bot (tsx src/index.ts)
pnpm run start:instagram        # run Instagram bot (tsx src/index-instagram.ts)
pnpm run dev                    # LinkedIn with tsx watch
pnpm run dev:instagram          # Instagram with tsx watch
pnpm run build                  # tsc -> dist/

./run-bot.sh [linkedin|instagram|both]   # wrapper (sources nvm/.bashrc, used by cron); default: both

pnpm run build:appimage:linkedin         # standalone AppImage (bundles Node 20 + chromium)
pnpm run build:appimage:instagram
pnpm run build:appimage:all
```

Note: `build-appimage.sh` still calls `npm`/`npx` internally — it runs inside a freshly downloaded, bundled Node 20 during packaging, independent of the dev toolchain.

No test suite and no linter are configured. There is no single-test command.

Behavior is driven entirely by `.env` (see `.env.example`), not CLI flags. Key vars: `RUN_ONCE` (true = run once and exit, for cron; false = loop every `CHECK_INTERVAL_MINUTES`), `HEADLESS`, `CSV_LOG_PATH`, plus per-platform credentials and the comma-separated `LINKEDIN_PAGES` / `INSTAGRAM_ACCOUNTS` lists.

## Architecture

Seven source files in `src/`, structured as two mirror-image bots plus shared logging, notifications and window options:

- `index.ts` / `index-instagram.ts` — entry points. Each validates env, parses the page list, then calls its bot in a `runBot` loop. `RUN_ONCE` chooses single-run-then-exit vs. `setInterval` continuous mode. Every page result is written to CSV via the shared logger.
- `linkedin.ts` (`LinkedInBot`) / `instagram.ts` (`InstagramBot`) — the two bot classes. They intentionally do NOT share a base class or interface despite near-identical shape (constructor, `initialize`, `ensureLoggedIn`, `checkPageForNewPosts`, `likePost`, `close`, and a duplicated `PageResult` interface). When changing shared behavior, expect to edit both files.
- `browserWindow.ts` — browser window options shared by both bots: headless keeps an emulated 1920x1080 viewport; a visible run opens a real 1280x800 window (`viewport: null`) with the class `auto-liker-bot` for the KWin rule (see Scheduling).
- `csvLogger.ts` (`CSVLogger`) — shared CSV logging. Appends rows with IST timestamps (UTC+5:30, computed by offsetting the Date manually), creates the file+headers and parent dir on construction, and CSV-escapes fields.

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

A broken run must never look like a quiet hour (LinkedIn served Cloudflare's "Just a moment..." page for 6 days in Nov 2026 while every run logged SUCCESS with 0 posts):

- **LinkedIn block pages are ERROR.** `detectBlockPage()` checks the title, the `challenges.cloudflare.com` iframe and the "Verify you are human" text, plus sign-in URLs (`authwall`, `login`, `checkpoint`) when checking a company page. The CSV reason carries the fix (run once with `HEADLESS=false`) and a screenshot path under `error-screenshots/` (newest 50 kept).
- **A LinkedIn page with no posts at all is ERROR**, not SUCCESS: it means a block page or a DOM change.
- **Notifications** (`notifier.ts`): any ERROR/TIMEOUT page raises `sendErrorNotification`, a critical popup with a sound that stays until dismissed and replaces the previous error popup (id kept in `.last-error-notification-<platform>`). A clean run that liked nothing shows no popup unless `NOTIFY_WHEN_NOTHING_NEW=true`.
- **Crashes** go through `failRun()` in both entry points: error popup, then exit code **2** ("already alerted"). The cron lines alert on any other non-zero exit (e.g. the AppImage failing to start) with their own `notify-send`.

## Scheduling

`setup-*-cron.sh` scripts install crontab entries that invoke `run-bot.sh` (which sources nvm/.bashrc so cron has a working `node`/`npm`). Cron runs assume `RUN_ONCE=true`.

The deployed LinkedIn AppImage (`~/apps/linked-bot`) runs from cron through `run-visible.sh` with `HEADLESS=false`: since Nov 2026 LinkedIn's Cloudflare check blocks headless Chromium even with a verified profile, while a visible browser passes. The wrapper takes the display variables from the running Plasma session and skips the run (exit 3) when nobody is logged in. Do not try to get headless past the check by disguising the browser (user agent, automation flags). `both-bots-cron.log` and `bot-results.csv` are runtime output committed in the repo root.

So a visible cron run doesn't disturb the desktop, `setup-kwin-rule.sh` installs a KWin rule (run it once per machine) matching window class `auto-liker-bot`. It forces "Accept focus: No" and focus stealing prevention to Extreme (on Wayland, Chromium still took focus with Extreme alone). The window also opens below other windows and off the taskbar, pager and Alt+Tab, applied only initially so it can still be raised. Mouse clicks still reach it, e.g. to tick a Cloudflare check.

## Conventions

- Timing is handled with fixed `waitForTimeout` delays throughout (rate-limit avoidance + letting infinite-scroll load) rather than smart waits — intentional, not a bug.
- `strict` TypeScript, run directly via `tsx` (no build step needed for normal use; `dist/` is only for AppImage packaging).
