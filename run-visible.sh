#!/bin/bash
# Run the LinkedIn bot AppImage with a visible browser on the desktop session (cron has no display).
# LinkedIn's Cloudflare check blocks headless Chromium, so the deployed .env sets HEADLESS=false.
# Takes DISPLAY, XAUTHORITY (its name changes every login), WAYLAND_DISPLAY, XDG_RUNTIME_DIR
# and DBUS_SESSION_BUS_ADDRESS from the running Plasma session.
# Deploy next to linkedin-bot.AppImage and point the cron line at it:
#   17 * * * * cd ~/apps/linked-bot && ./run-visible.sh >> cron-output.log 2>&1
cd "$(dirname "$(readlink -f "$0")")" || exit 1

pid=$(pgrep -u "$(id -u)" -x plasmashell | head -1)
if [ -z "$pid" ]; then
  echo "$(date '+%F %T') No desktop session (plasmashell not running); skipping this run."
  exit 3
fi
while IFS= read -r -d '' kv; do
  case "$kv" in
    DISPLAY=*|XAUTHORITY=*|WAYLAND_DISPLAY=*|XDG_RUNTIME_DIR=*|DBUS_SESSION_BUS_ADDRESS=*) export "$kv" ;;
  esac
done < "/proc/$pid/environ"

exec ./linkedin-bot.AppImage
