#!/usr/bin/env bash
# Print a compatible CLI binary; never bypass Composer's platform check.
set -euo pipefail
hafrik_runtime_root="${1:?Usage: hafrik-php.sh /absolute/hafrik-root}"
hafrik_runtime_min=0
hafrik_runtime_check="$hafrik_runtime_root/vendor/composer/platform_check.php"
if [ -f "$hafrik_runtime_check" ]; then
  hafrik_runtime_min="$(sed -nE 's/.*PHP_VERSION_ID >= ([0-9]+).*/\1/p' "$hafrik_runtime_check" | head -n 1)"
  hafrik_runtime_min="${hafrik_runtime_min:-0}"
fi
hafrik_runtime_candidates=()
if [ -n "${PHP_BIN:-}" ]; then
  hafrik_runtime_candidates=("$PHP_BIN")
else
  hafrik_runtime_candidates=("$(command -v php || true)" /www/server/php/85/bin/php /www/server/php/84/bin/php /usr/bin/php8.5 /usr/bin/php8.4 /opt/remi/php85/root/usr/bin/php /opt/remi/php84/root/usr/bin/php)
fi
for hafrik_runtime_binary in "${hafrik_runtime_candidates[@]}"; do
  [ -x "$hafrik_runtime_binary" ] || continue
  hafrik_runtime_version="$("$hafrik_runtime_binary" -r 'echo PHP_VERSION_ID;' 2>/dev/null)" || continue
  [[ "$hafrik_runtime_version" =~ ^[0-9]+$ ]] || continue
  if [ "$hafrik_runtime_version" -ge "$hafrik_runtime_min" ]; then
    printf '%s\n' "$hafrik_runtime_binary"
    exit 0
  fi
done
printf 'No compatible PHP CLI found. Hafrik requires PHP_VERSION_ID >= %s. Install/select the matching PHP version (8.4.1+ for this Hafrik release), or set PHP_BIN=/absolute/path/to/php.\n' "$hafrik_runtime_min" >&2
exit 2
