# Deploying ChinaLife: guide for AI assistants

This guide is for AI assistants working on ChinaLife. You usually **cannot reach the server yourself**: SSH and
production access may be blocked. You prepare everything, the owner pastes commands into the server terminal, and you
read back what they paste. Write every server step so it is safe for that workflow.

## The server

**Moved 21 Oct 2026:** ChinaLife (game + API) now runs on the NEW server **167.104.97.44** (`root@HKSecyGo-TheGlitzHub-Server`):
Ubuntu 24.04, CyberPanel, OpenLiteSpeed, lsphp 8.4, MariaDB 10.11, Redis. The old aaPanel server 45.91.95.13
(`/www/wwwroot/...`) only keeps a rollback copy: **never deploy there again.**

OpenLiteSpeed reads only rewrite rules from `.htaccess`. `Header`, `AddType`, `FilesMatch`, `Expires` and `Deny` lines are
ignored, so the game's cache headers (no-cache for html/js/css, immutable for hashed bundles, `lazy.*.js` and `r7/`) and
the `chinalife-music/` cache headers live in the vhost files
`/usr/local/lsws/conf/vhosts/china-life.hafrik.com/vhost.conf` and `/usr/local/lsws/conf/vhosts/hafrik.com/vhost.conf`.
If you add a new hashed bundle name pattern, update the vhost too. Back up the file first, then run
`/usr/local/lsws/bin/lswsctrl restart`.
File owners: game files `china6403:china6403`, Hafrik/API files `hafri1918:hafri1918`. After copying as root, run
`chown -R china6403:china6403 /home/china-life.hafrik.com/public_html/*` and
`chown -R hafri1918:hafri1918 /home/hafrik.com/public_html/api/v4/chinalife`.
Front-end release backups: `/root/backups/<release>-<time>` on the new server (same convention as before).

| What | Path |
|---|---|
| Git checkout the server deploys from | not set up on the new server yet: `git clone https://github.com/theglitzhub8/CHINA-LIFE.git /root/chinalife-source` (always on `main`); the old `/www/chinalife-source` stays on 45.91.95.13 |
| Hafrik root | `/home/hafrik.com/public_html` |
| ChinaLife API (from `chinalife-api/`) | `/home/hafrik.com/public_html/api/v4/chinalife` → `https://hafrik.com/api/v4/chinalife/` |
| Game files (from `public/`) | `/home/china-life.hafrik.com/public_html` → `https://china-life.hafrik.com/` |
| PHP CLI | `/usr/local/lsws/lsphp84/bin/php` |
| Logs | `/home/hafrik.com/logs/hafrik.com.access_log` (API calls), `/home/hafrik.com/logs/hafrik.com.error_log` |
| Backups | `/root/backup` |

## Normal deploy

1. Run `npm test` and keep it green. Commit only your own files (other AI sessions work in the same checkout), then push
   to `main`. The server deploys **whatever is on `main`**, so never push unfinished or unapproved features there.
   Put those on their own branch (for example `feature/politics`).
2. Give the owner the update command:
   ```bash
   cd /root/chinalife-source
   ./scripts/update-server.sh /home/hafrik.com/public_html /home/china-life.hafrik.com/public_html
   ```
   `update-server.sh` runs `git pull --ff-only origin main`, then `scripts/deploy-php.sh`. That script rsyncs `public/`
   (with `index.html` last) and `chinalife-api/`. It never deletes server files.
3. **Only if** `chinalife-api/migration-all.sql` or `migrate.php` changed, also give:
   ```bash
   /usr/local/lsws/lsphp84/bin/php /home/hafrik.com/public_html/api/v4/chinalife/migrate.php
   ```
   Migrations must be safe to run again: `CREATE TABLE IF NOT EXISTS`, and columns added only when missing (the list
   in `migrate.php`). Never drop, truncate or rewrite player data. If new code needs a new table, either deploy the
   migration first or make the code work without it.
4. Tell the owner what to check in the game afterwards.

## Bigger or risky deploys

Use the Batch 1 procedure in `docs/PERF-BATCH1-DEPLOY.md` as the template: back up, migrate, deploy, verify, then
roll out behind a switch. Back up first:
```bash
mkdir -p /root/backup && T=$(date +%F-%H%M)
tar czf /root/backup/chinalife-files-$T.tgz -C /home hafrik.com/public_html/api/v4/chinalife china-life.hafrik.com/public_html
mysqldump -u DB_USER -p --single-transaction --quick DB_NAME | gzip > /root/backup/hafrik-db-$T.sql.gz
gunzip -t /root/backup/hafrik-db-$T.sql.gz && zcat /root/backup/hafrik-db-$T.sql.gz | tail -1    # must say "Dump completed"
```
The database name, user and password are in CyberPanel → Databases (live DB `hafr_hafrikcom2`; never print the password). The MySQL root password the owner tried was
rejected, so use the Hafrik database user. Never write credentials into the repo, the chat or a URL.

Verify after a deploy (each command must pass):
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://hafrik.com/api/v4/chinalife/presence.php     # 401 = alive and auth works
for f in index.html cloud.js; do curl -s https://china-life.hafrik.com/$f | sha256sum; sha256sum /root/chinalife-source/public/$f; done   # pairs must match
tail -n 30 /home/hafrik.com/logs/hafrik.com.error_log | grep -i chinalife
```

## Writing commands for the owner

These rules come from real mistakes:
- **One purpose per block, and say "run this block on its own."** The owner pastes many blocks at once.
  - A script that asks questions with `read` then took the next pasted lines as its answers.
  - An "emergency rollback" line pasted with the rest immediately undid the step before it.
  - Never put the rollback command in the same block as the step it undoes.
- **For multi-step deploys, write a script file with a heredoc and `set -euo pipefail`, then run it separately.**
  It stops at the first failed check, and the owner pastes back one clear output.
- **Make scripts and edits safe to repeat.** A `sed` fix the owner ran twice doubled a line. Use idempotent commands,
  or show a check (`grep -n`) after each edit.
- Wait for the pasted output before the next step, and read it carefully: a missing final line means the script was
  still running or stopped.

## Never do this

- Change OpenLiteSpeed/lsphp, MariaDB, Redis or OPcache settings, restart services, or delete game data. Leave the
  harmless "Module zip/mbstring already loaded" CLI warning alone.
- Commit server-only files. They stay on the server and deploys never overwrite them:
  - `chinalife-api/turn-config.php`, `admin-config.php`, `push-config.php`, `ai-config.php`, `music-config.php`;
  - `chinalife-api/polling-config.json`.

  Commit an `.example` file instead.
- Restore the database backup to undo a code problem: that erases players' progress. Roll back code with the file
  backup (`tar xzf /root/backup/chinalife-files-<time>.tgz -C /home`) and by reverting the commit on `main`.
- Change the approved city map (see `CLAUDE.md`).

## Switches the server reads

`/home/hafrik.com/public_html/api/v4/chinalife/polling-config.json` controls the Batch 1 adaptive polling. It is read on
every request, so a change applies within about 10 s, with no deploy:

| Content | Effect |
|---|---|
| `{"mode":"legacy"}` or file missing | old polling for everyone (kill switch) |
| `{"mode":"testers","testers":["hafrik"],"percent":10}` | listed usernames or ids, plus that share of players |
| `{"mode":"adaptive"}` | new polling for everyone |

## Monitoring (read-only)

`scripts/perf-monitor.php` reports, once a minute:
- requests/s and HTTP errors;
- lsphp CPU and workers;
- machine CPU, load and memory;
- database queries/s;
- player position freshness.

At the end it prints a per-endpoint summary. Copy it to `/root` and run it in the background:
```bash
git -C /root/chinalife-source show origin/main:scripts/perf-monitor.php > /root/perf-monitor.php
nohup /usr/local/lsws/lsphp84/bin/php /root/perf-monitor.php --hafrik=/home/hafrik.com/public_html \
  --log=/home/hafrik.com/logs/hafrik.com.access_log --interval=60 --samples=30 \
  --csv=/root/perf-NAME.csv --endpoints-csv=/root/perf-NAME-endpoints.csv > /root/perf-NAME.log 2>&1 &
```
Baseline at 3 AM Beijing, 2026-10-10:
- 5.3 ChinaLife API requests/s with 2 players online, about 160 per player per minute on the old polling;
- PHP 8.4 workers at about 50% of one core, the machine at 40% CPU, load 1.7;
- the database at 104 queries/s, with 12 GB of memory free.
