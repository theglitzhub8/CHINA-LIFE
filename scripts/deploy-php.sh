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
rsync -a --exclude=index.html --exclude=.user.ini "$source_root/public/" "$game_root/"
# Server-only credentials must never be copied from a developer checkout.
# Existing archives are blocked by .htaccess; remove them manually after review.
rsync -a --include=shared-config.php --include=studio-config.php --include=fortune-config.php --include=services-config.php --exclude='*-config.php' --exclude=polling-config.json --exclude='.env*' --exclude='*.zip' --exclude='*.tar*' --exclude='*.gz' --exclude='*.bak' --exclude='*.old' --exclude='__MACOSX/' "$source_root/chinalife-api/" "$hafrik_root/api/v4/chinalife/"
rsync -a "$source_root/public/index.html" "$game_root/index.html"
# Public "How to play" page at hafrik.com/how-to-play
mkdir -p "$hafrik_root/how-to-play"
rsync -a "$source_root/landing/how-to-play/" "$hafrik_root/how-to-play/"
echo "Files deployed. Run: php '$hafrik_root/api/v4/chinalife/migrate.php'"
echo 'Then test two Hafrik accounts in the same city and venue.'
