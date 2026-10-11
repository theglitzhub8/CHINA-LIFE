#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 1 ] || [[ "$1" != /* ]]; then
  echo 'Usage: ./scripts/check-hafrik-integration.sh /absolute/path/to/hafrik-root' >&2
  exit 2
fi
hafrik_integration_root="$1/api/v4"
hafrik_integration_missing=0
for endpoint in notifications/_admin_notify notifications/_push business/list business/view business/follow communities/list communities/view communities/join communities/leave people/list people/follow_toggle hafrikx/academy/courses hafrikx/academy/course-detail hafrikx/academy/apply events/list events/detail events/rsvp marketplace/get_marketplace marketplace/get_product exchange/rates_get exchange/quote exchange/orders_my; do
  if [ ! -f "$hafrik_integration_root/$endpoint.php" ]; then
    echo "Missing Hafrik module: api/v4/$endpoint.php" >&2
    hafrik_integration_missing=1
  fi
done
if [ "$hafrik_integration_missing" -ne 0 ]; then
  echo 'Install the matching Hafrik API modules before deploying this integration.' >&2
  exit 1
fi
echo 'Hafrik integration endpoint files are present. Authenticated live checks still required.'
