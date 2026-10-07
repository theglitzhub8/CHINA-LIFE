#!/usr/bin/env bash
set -euo pipefail
source_root="$(cd "$(dirname "$0")/.." && pwd)"
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 /absolute/path/to/hafrik-root /absolute/path/to/game-document-root" >&2
  exit 2
fi
git -C "$source_root" pull --ff-only origin main
exec "$source_root/scripts/deploy-php.sh" "$@"
