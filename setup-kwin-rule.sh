#!/bin/bash
# Install a KWin (KDE Plasma) window rule for the bot's visible browser window, so a cron
# run never takes focus from what you are working on. It matches the window class that
# src/browserWindow.ts gives Chromium (--class=auto-liker-bot) and:
#   - forces focus stealing prevention to Extreme and "Accept focus: No": on Wayland, Chromium
#     still took focus with Extreme alone. Mouse clicks still reach the window.
#   - opens the window below other windows, off the taskbar, pager and Alt+Tab
#     ("apply initially", so you can still raise and use it, e.g. to pass a Cloudflare check)
# Safe to run again: it rewrites the same rule.
set -euo pipefail

RULE=auto-liker-bot-0b1f6c2e
CLASS=auto-liker-bot
FILE=kwinrulesrc

w() { kwriteconfig6 --file "$FILE" --group "$RULE" --key "$1" "$2"; }

w Description "Auto-Liker bot browser: no focus, below other windows"
w wmclass "$CLASS"
w wmclassmatch 1          # exact match
w wmclasscomplete false
w fsplevel 4              # focus stealing prevention: Extreme
w fsplevelrule 2          # force
w acceptfocus false
w acceptfocusrule 2       # force
w below true
w belowrule 3             # apply initially
w skiptaskbar true
w skiptaskbarrule 3
w skippager true
w skippagerrule 3
w skipswitcher true
w skipswitcherrule 3

order=$(kreadconfig6 --file "$FILE" --group General --key Order)
case ",$order," in
  *",$RULE,"*) ;;
  *) order="${order:+$order,}$RULE" ;;
esac
kwriteconfig6 --file "$FILE" --group General --key Order "$order"
kwriteconfig6 --file "$FILE" --group General --key count "$(tr ',' '\n' <<<"$order" | grep -c .)"

qdbus6 org.kde.KWin /KWin reconfigure
echo "KWin rule '$RULE' installed for window class '$CLASS'."
