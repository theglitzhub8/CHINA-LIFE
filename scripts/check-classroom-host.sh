#!/usr/bin/env bash
set -euo pipefail
printf 'ChinaLife classroom hosting check (read-only)\n'
if command -v node >/dev/null 2>&1; then node --version; else printf 'Node.js: not on PATH\n'; fi
if command -v nginx >/dev/null 2>&1; then nginx -v 2>&1; else printf 'nginx: not on PATH (check your server panel)\n'; fi
if command -v systemctl >/dev/null 2>&1; then printf 'systemd tooling: available\n'; else printf 'Use your server panel process manager\n'; fi
printf 'Not verified: secure WebSocket proxy, process supervision and public connection reachability.\nNo configuration or services were changed.\n'
