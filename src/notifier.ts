import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Minimal shape shared by both bots' PageResult / the CSV RunResult.
export interface NotifiableResult {
  page: string;
  newPostsFound: number;
  successfulLikes: number;
  failedPosts: number;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'PARTIAL';
  errorMessage?: string;
}

// Cron runs with a bare environment (no DISPLAY/DBUS), so notify-send can't reach
// the user's session bus on its own. Fill in sensible defaults from the uid.
function notificationEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;

  if (!env.DISPLAY) env.DISPLAY = ':0';
  if (uid !== undefined) {
    if (!env.XDG_RUNTIME_DIR) env.XDG_RUNTIME_DIR = `/run/user/${uid}`;
    if (!env.DBUS_SESSION_BUS_ADDRESS) {
      env.DBUS_SESSION_BUS_ADDRESS = `unix:path=/run/user/${uid}/bus`;
    }
  }
  return env;
}

// Shorten a page/account URL to its handle for a compact notification line.
function shortName(page: string): string {
  if (page === 'ALL') return 'ALL';
  try {
    const parts = new URL(page).pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || page;
  } catch {
    return page;
  }
}

// The id of the last error notification is kept per platform, so an error that
// repeats every hour replaces its popup instead of stacking a new one each run.
function errorIdFile(platform: string): string {
  return path.join(process.cwd(), `.last-error-notification-${platform.toLowerCase()}`);
}

function sendDesktopNotification(title: string, body: string, critical: boolean): void {
  try {
    const child = spawn(
      'notify-send',
      [
        '--app-name=Auto-Liker',
        `--urgency=${critical ? 'critical' : 'normal'}`,
        '--expire-time=0', // 0 = stay on screen until the user dismisses it
        title,
        body,
      ],
      { env: notificationEnv(), stdio: 'ignore' }
    );
    // notify-send missing / no session bus: log but never crash the run.
    child.on('error', (err) => {
      console.log(`(desktop notification skipped: ${err.message})`);
    });
  } catch (e) {
    console.log(`(desktop notification skipped: ${e instanceof Error ? e.message : 'unknown error'})`);
  }
}

// Critical popup that stays until dismissed, with a sound. Runs synchronously so it
// is delivered even when the caller exits right after (crash path).
export function sendErrorNotification(platform: string, title: string, body: string): void {
  if (process.env.ENABLE_NOTIFICATIONS === 'false') return;
  if (process.platform !== 'linux') return;

  const env = notificationEnv();
  const idFile = errorIdFile(platform);
  const args = ['--app-name=Auto-Liker', '--urgency=critical', '--expire-time=0', '--icon=dialog-error', '--print-id'];
  try {
    const previousId = fs.existsSync(idFile) ? fs.readFileSync(idFile, 'utf8').trim() : '';
    if (/^\d+$/.test(previousId)) args.push(`--replace-id=${previousId}`);
  } catch {
    // no previous id: show a fresh popup
  }
  args.push(title, body);

  try {
    const res = spawnSync('notify-send', args, { env, encoding: 'utf8', timeout: 10000 });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(res.stderr?.trim() || `exit ${res.status}`);
    const id = (res.stdout || '').trim();
    if (/^\d+$/.test(id)) fs.writeFileSync(idFile, id);
    spawn('canberra-gtk-play', ['-i', 'dialog-error'], { env, stdio: 'ignore' }).on('error', () => {});
    console.log(`Error notification shown: ${title}`);
  } catch (e) {
    console.log(`(error notification failed: ${e instanceof Error ? e.message : 'unknown error'})`);
  }
}

// For the entry points: an unexpected crash shows the same critical popup, then
// exits with 2 ("already alerted"); the cron line alerts on any other non-zero exit,
// e.g. the AppImage failing to start.
export function failRun(platform: string, error: unknown): never {
  console.error(`${platform} bot crashed:`, error);
  const message = error instanceof Error ? error.message : String(error);
  sendErrorNotification(
    platform,
    `${platform} bot ✗ crashed`,
    `${message}\nReview: the cron log in ${process.cwd()}`
  );
  process.exit(2);
}

// One line per failed page, plus where to look, for the error popup body.
function errorDetails(results: NotifiableResult[]): string {
  const lines = results
    .filter((r) => r.status === 'ERROR' || r.status === 'TIMEOUT')
    .map((r) => `${shortName(r.page)}: ${r.status.toLowerCase()}${r.errorMessage ? ` — ${r.errorMessage}` : ''}`);
  const csvPath = process.env.CSV_LOG_PATH || './bot-results.csv';
  lines.push(`Review: ${path.resolve(process.cwd(), csvPath)} and the cron log in ${process.cwd()}`);
  return lines.join('\n');
}

// Fire one desktop notification summarizing a completed run: overall status plus
// per-page like counts. Works even in headless mode (it spawns notify-send, which
// talks to the desktop over DBUS, independent of the bot's browser).
export function notifyRunComplete(platform: string, results: NotifiableResult[]): void {
  if (process.env.ENABLE_NOTIFICATIONS === 'false') return;
  if (process.platform !== 'linux') return; // notify-send is Linux/libnotify only
  if (results.length === 0) return;

  const totalLiked = results.reduce((sum, r) => sum + r.successfulLikes, 0);
  const hasError = results.some((r) => r.status === 'ERROR' || r.status === 'TIMEOUT');
  const hasIssue = results.some((r) => r.status === 'PARTIAL' || r.failedPosts > 0);

  // Errors get their own critical popup (sound, stays until dismissed, replaces the
  // previous error popup) so a broken bot can't pass for a quiet hour.
  if (hasError) {
    const failed = results.filter((r) => r.status === 'ERROR' || r.status === 'TIMEOUT').length;
    sendErrorNotification(
      platform,
      `${platform} bot ✗ needs attention — ${failed} of ${results.length} page(s) failed, ${totalLiked} liked`,
      errorDetails(results)
    );
    return;
  }

  // A clean run that found nothing new needs no popup; an hourly "0 liked" popup
  // only teaches you to ignore them. Set NOTIFY_WHEN_NOTHING_NEW=true to keep it.
  if (!hasIssue && totalLiked === 0 && process.env.NOTIFY_WHEN_NOTHING_NEW !== 'true') {
    console.log('(no desktop notification: nothing new to like)');
    return;
  }

  const icon = hasIssue ? '⚠' : '✓';
  const statusWord = hasIssue ? 'Partial' : 'Success';
  const title = `${platform} ${icon} ${statusWord} — ${totalLiked} liked`;

  const lines = results.map((r) => {
    if (r.page === 'ALL' || r.status === 'ERROR') {
      return `${shortName(r.page)}: error${r.errorMessage ? ` — ${r.errorMessage}` : ''}`;
    }
    const parts = [`${r.successfulLikes} liked`];
    if (r.failedPosts > 0) parts.push(`${r.failedPosts} failed`);
    if (r.newPostsFound === 0) parts.push('up to date');
    return `${shortName(r.page)}: ${parts.join(', ')}`;
  });

  sendDesktopNotification(title, lines.join('\n'), false);
}
