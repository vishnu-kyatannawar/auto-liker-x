import { spawn } from 'child_process';

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

function sendDesktopNotification(title: string, body: string, critical: boolean): void {
  try {
    const child = spawn(
      'notify-send',
      ['--app-name=Auto-Liker', `--urgency=${critical ? 'critical' : 'normal'}`, title, body],
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

// Fire one desktop notification summarizing a completed run: overall status plus
// per-page like counts. Works even in headless mode (it spawns notify-send, which
// talks to the desktop over DBUS, independent of the bot's browser).
export function notifyRunComplete(platform: string, results: NotifiableResult[]): void {
  if (process.env.ENABLE_NOTIFICATIONS === 'false') return;
  if (process.platform !== 'linux') return; // notify-send is Linux/libnotify only
  if (results.length === 0) return;

  const totalLiked = results.reduce((sum, r) => sum + r.successfulLikes, 0);
  const hasError = results.some((r) => r.status === 'ERROR');
  const hasIssue = results.some(
    (r) => r.status === 'PARTIAL' || r.status === 'TIMEOUT' || r.failedPosts > 0
  );

  const icon = hasError ? '✗' : hasIssue ? '⚠' : '✓';
  const statusWord = hasError ? 'Error' : hasIssue ? 'Partial' : 'Success';
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

  sendDesktopNotification(title, lines.join('\n'), hasError);
}
