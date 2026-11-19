// Window options shared by both bots.
//
// Headless runs keep an emulated 1920x1080 viewport. A visible run (cron through
// run-visible.sh) opens a real 1280x800 window with the page sized to it, so the
// window and page sizes agree, and gives it the X11/Wayland class WINDOW_CLASS.
// The KWin rule from setup-kwin-rule.sh matches that class to keep the window
// from taking focus and to open it below other windows, off the taskbar.
export const WINDOW_CLASS = 'auto-liker-bot';

const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 800;

export function windowOptions(headless: boolean) {
  if (headless) {
    return { viewport: { width: 1920, height: 1080 } };
  }
  return {
    viewport: null,
    args: [`--class=${WINDOW_CLASS}`, `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`],
  };
}
