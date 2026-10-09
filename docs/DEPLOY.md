# Deploying ChinaLife: guide for AI assistants

This guide is for AI assistants working on ChinaLife. You usually **cannot reach the server yourself**: SSH and
production access may be blocked. You prepare everything, the owner pastes commands into the server terminal, and you
read back what they paste. Write every server step so it is safe for that workflow.

## The server

Ubuntu, aaPanel, 4 cores, 16 GB. Apache, PHP-FPM 8.4 (8.3 also runs), MariaDB, Redis. The owner's terminal prompt is
`root@HafrikNewServer`.

| What | Path |
|---|---|
| Git checkout the server deploys from | `/www/chinalife-source` (always on `main`) |
| Hafrik root | `/www/wwwroot/hafrik.com` |
| ChinaLife API (from `chinalife-api/`) | `/www/wwwroot/hafrik.com/api/v4/chinalife` → `https://hafrik.com/api/v4/chinalife/` |
| Game files (from `public/`) | `/www/wwwroot/china-life.hafrik.com/public` → `https://china-life.hafrik.com/` |
| PHP CLI | `/www/server/php/84/bin/php` |
| Logs | `/www/wwwlogs/hafrik.com-access_log` (API calls), `/www/wwwlogs/hafrik.com-error_log` |
| Backups | `/root/backup` |

## Normal deploy

1. Run `npm test` and keep it green. Commit only your own files (other AI sessions work in the same checkout), then push
   to `main`. The server deploys **whatever is on `main`**, so never push unfinished or unapproved features there.
   Put those on their own branch (for example `feature/politics`).
2. Give the owner the update command:
   ```bash
   cd /www/chinalife-source
   ./scripts/update-server.sh /www/wwwroot/hafrik.com /www/wwwroot/china-life.hafrik.com/public
   ```
   `update-server.sh` runs `git pull --ff-only origin main`, then `scripts/deploy-php.sh`. That script rsyncs `public/`
   (with `index.html` last) and `chinalife-api/`. It never deletes server files.
3. **Only if** `chinalife-api/migration-all.sql` or `migrate.php` changed, also give:
   ```bash
   /www/server/php/84/bin/php /www/wwwroot/hafrik.com/api/v4/chinalife/migrate.php
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
tar czf /root/backup/chinalife-files-$T.tgz -C /www/wwwroot hafrik.com/api/v4/chinalife china-life.hafrik.com/public
mysqldump -u DB_USER -p --single-transaction --quick DB_NAME | gzip > /root/backup/hafrik-db-$T.sql.gz
gunzip -t /root/backup/hafrik-db-$T.sql.gz && zcat /root/backup/hafrik-db-$T.sql.gz | tail -1    # must say "Dump completed"
```
The database name, user and password are in aaPanel → Databases. The MySQL root password the owner tried was
rejected, so use the Hafrik database user. Never write credentials into the repo, the chat or a URL.

Verify after a deploy (each command must pass):
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://hafrik.com/api/v4/chinalife/presence.php     # 401 = alive and auth works
for f in index.html cloud.js; do curl -s https://china-life.hafrik.com/$f | sha256sum; sha256sum /www/chinalife-source/public/$f; done   # pairs must match
tail -n 30 /www/wwwlogs/hafrik.com-error_log | grep -i chinalife
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

- Change Apache, PHP-FPM, MariaDB, Redis or OPcache settings, restart services, or delete game data. Leave the
  harmless "Module zip/mbstring already loaded" CLI warning alone.
- Commit server-only files. They stay on the server and deploys never overwrite them:
  - `chinalife-api/turn-config.php`, `admin-config.php`, `push-config.php`, `ai-config.php`, `music-config.php`;
  - `chinalife-api/polling-config.json`.

  Commit an `.example` file instead.
- Restore the database backup to undo a code problem: that erases players' progress. Roll back code with the file
  backup (`tar xzf /root/backup/chinalife-files-<time>.tgz -C /www/wwwroot`) and by reverting the commit on `main`.
- Change the approved city map (see `CLAUDE.md`).

## Switches the server reads

`/www/wwwroot/hafrik.com/api/v4/chinalife/polling-config.json` controls the Batch 1 adaptive polling. It is read on
every request, so a change applies within about 10 s, with no deploy:

| Content | Effect |
|---|---|
| `{"mode":"legacy"}` or file missing | old polling for everyone (kill switch) |
| `{"mode":"testers","testers":["hafrik"],"percent":10}` | listed usernames or ids, plus that share of players |
| `{"mode":"adaptive"}` | new polling for everyone |

## Monitoring (read-only)

`scripts/perf-monitor.php` reports, once a minute:
- requests/s and HTTP errors;
- PHP-FPM CPU and workers;
- machine CPU, load and memory;
- database queries/s;
- player position freshness.

At the end it prints a per-endpoint summary. Copy it to `/root` and run it in the background:
```bash
git -C /www/chinalife-source show origin/main:scripts/perf-monitor.php > /root/perf-monitor.php
nohup /www/server/php/84/bin/php /root/perf-monitor.php --hafrik=/www/wwwroot/hafrik.com \
  --log=/www/wwwlogs/hafrik.com-access_log --interval=60 --samples=30 \
  --csv=/root/perf-NAME.csv --endpoints-csv=/root/perf-NAME-endpoints.csv > /root/perf-NAME.log 2>&1 &
```
Baseline at 3 AM Beijing, 2026-10-10:
- 5.3 ChinaLife API requests/s with 2 players online, about 160 per player per minute on the old polling;
- PHP 8.4 workers at about 50% of one core, the machine at 40% CPU, load 1.7;
- the database at 104 queries/s, with 12 GB of memory free.
