#!/usr/bin/env bash
set -euo pipefail
hafrik_notify_root="${1:?Usage: run-life-notifications.sh /absolute/hafrik-root}"
hafrik_notify_scripts="$(cd "$(dirname "$0")" && pwd)"
hafrik_notify_php="$(bash "$hafrik_notify_scripts/hafrik-php.sh" "$hafrik_notify_root")"
exec "$hafrik_notify_php" "$hafrik_notify_root/api/v4/chinalife/dispatch-life-notifications.php"
