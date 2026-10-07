#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 /absolute/path/to/hafrik-root /absolute/path/to/game-document-root" >&2
  exit 2
fi
source_root="$(cd "$(dirname "$0")/.." && pwd)"
hafrik_root="$1"
game_root="$2"
case "$hafrik_root" in /*) ;; *) echo 'Hafrik root must be absolute' >&2; exit 2;; esac
case "$game_root" in /*) ;; *) echo 'Game root must be absolute' >&2; exit 2;; esac
if [ ! -f "$hafrik_root/api/v4/db.php" ] || [ ! -f "$hafrik_root/api/v4/helpers.php" ]; then
  echo 'Hafrik root must contain api/v4/db.php and api/v4/helpers.php' >&2
  exit 2
fi
mkdir -p "$game_root" "$hafrik_root/api/v4/chinalife"
if [ "$(cd "$game_root" && pwd)" = "$source_root" ]; then
  echo 'Keep the source checkout separate from the public game document root' >&2
  exit 2
fi
command -v rsync >/dev/null || { echo 'Install rsync before deploying' >&2; exit 2; }
# Do not delete host files or replace Hafrik's shared configuration/authentication.
# Copy HTML last so newly requested scripts are already available.
rsync -a --exclude=index.html "$source_root/public/" "$game_root/"
rsync -a "$source_root/chinalife-api/" "$hafrik_root/api/v4/chinalife/"
rsync -a "$source_root/public/index.html" "$game_root/index.html"
echo "Files deployed. Run: php '$hafrik_root/api/v4/chinalife/migrate.php'"
echo 'Then test two Hafrik accounts in the same city and venue.'
