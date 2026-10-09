# Performance Batch 1: deployment, verification and rollback

Status: **prepared, not deployed.** Nothing here runs until the owner approves.

Paths used below (change them if the server differs):

| What | Path |
|---|---|
| Source checkout | `/www/chinalife-source` |
| Hafrik root / API | `/www/wwwroot/hafrik.com`, `/www/wwwroot/hafrik.com/api/v4/chinalife` |
| Game files | `/www/wwwroot/china-life.hafrik.com/public` |
| PHP CLI | `/www/server/php/84/bin/php` |
| Apache access log | `/www/wwwlogs/hafrik.com-access_log` (confirm with `ls -l /www/wwwlogs/`) |

Rollback points: git tag `perf-before-batch-1` (the code now live), plus the file and database backups made in step 1.

## How the rollout is controlled

`api/v4/chinalife/polling-config.json` exists only on the server. Deploys never overwrite it, and it is read on every
request, so a change applies at once. Every game also starts on the old polling until the server tells it otherwise.

| File content | Effect |
|---|---|
| file missing or broken | everyone on the old polling (legacy) |
| `{"mode":"legacy"}` | everyone on the old polling: **the kill switch** |
| `{"mode":"testers","testers":["hafrik","name2"],"percent":0}` | only these Hafrik usernames or user ids on the new polling |
| `{"mode":"testers","testers":["hafrik"],"percent":10}` | testers plus a fixed 10% of other players |
| `{"mode":"adaptive"}` | everyone on the new polling |

Players on legacy cost the server exactly what they cost today: their heartbeat gets only the mode back and no extra
queries.

## Step 0: baseline (read-only, before anything changes)

Run for at least one hour at a normal busy time. Note the time of day so the comparison after deploy is fair.

```bash
cd /www/chinalife-source && git fetch origin perf/batch-1
git show origin/perf/batch-1:scripts/perf-monitor.php > /root/perf-monitor.php
nohup /www/server/php/84/bin/php /root/perf-monitor.php --hafrik=/www/wwwroot/hafrik.com \
  --log=/www/wwwlogs/hafrik.com-access_log --interval=60 --csv=/root/perf-baseline.csv > /root/perf-baseline.log 2>&1 &
tail -f /root/perf-baseline.log        # Ctrl+C stops viewing; the monitor keeps running
pkill -f perf-monitor.php              # stop it after the hour
```

Each line shows:
- ChinaLife API requests/s, and 4xx / 429 / 5xx counts;
- PHP-FPM CPU per PHP version and Apache CPU (% of one core), whole-machine CPU and load;
- MariaDB queries/s for the whole server (reads, writes, running threads, new slow queries);
- players online, and how old each player's last position is (p50/p95, together vs alone). Another player sees you
  at most that old plus their own heartbeat.

## Step 1: backups

```bash
mkdir -p /root/backup && cd /root/backup
# Game files exactly as they are now
tar czf chinalife-files-before-batch1-$(date +%F-%H%M).tgz -C /www/wwwroot \
  hafrik.com/api/v4/chinalife china-life.hafrik.com/public
# Database: aaPanel → Databases → Backup on the Hafrik database, or (asks for the MySQL root password):
mysql -u root -p -e 'SHOW DATABASES'                    # find the Hafrik database name
mysqldump -u root -p --single-transaction --quick --routines --triggers HAFRIK_DB \
  | gzip > hafrik-db-before-batch1-$(date +%F-%H%M).sql.gz
# Check both backups
gunzip -t hafrik-db-before-batch1-*.sql.gz && zcat hafrik-db-before-batch1-*.sql.gz | grep -c 'CREATE TABLE'
tar tzf chinalife-files-before-batch1-*.tgz | wc -l
ls -lh /root/backup
```

## Step 2: merge (done from the development machine after approval)

Merge `perf/batch-1` into `main` and push. CI-equivalent: `npm test` must be green (272 tests at preparation time).

## Step 3: deploy (migration first, legacy for everyone)

```bash
cd /www/chinalife-source
git pull --ff-only origin main && git log --oneline -1
API=/www/wwwroot/hafrik.com/api/v4/chinalife
# 3a. Switch set to legacy before any new code exists
echo '{"mode":"legacy"}' > $API/polling-config.json && chmod 644 $API/polling-config.json
# 3b. Migration before code: only the schema files are copied, then run twice (the second run proves it is idempotent;
#     every statement is CREATE TABLE IF NOT EXISTS or an "add column if missing" check; nothing is dropped or rewritten)
cp chinalife-api/migration-all.sql chinalife-api/migrate.php $API/
/www/server/php/84/bin/php $API/migrate.php
/www/server/php/84/bin/php $API/migrate.php
mysql -u root -p HAFRIK_DB -e 'SHOW CREATE TABLE chinalife_inbox\G'
# 3c. Code (game files first, index.html last, as deploy-php.sh already does)
./scripts/deploy-php.sh /www/wwwroot/hafrik.com /www/wwwroot/china-life.hafrik.com/public
```

## Step 4: verify (still legacy for everyone)

```bash
# Syntax of the changed PHP
for f in common.php presence.php messages.php activities.php home-visits.php; do /www/server/php/84/bin/php -l $API/$f; done
# API alive and still requires sign-in (expect 401)
curl -s -o /dev/null -w '%{http_code}\n' https://hafrik.com/api/v4/chinalife/presence.php
# No stale assets: expect 200 and "Cache-Control: no-cache, must-revalidate"; any cf-cache-status / x-cache line
# means a CDN sits in front and must be checked too
for f in index.html poller.js cloud.js notifications.js; do echo "== $f"; \
  curl -sI https://china-life.hafrik.com/$f | grep -i -E '^HTTP|cache-control|etag|last-modified|cf-cache|x-cache|age:'; done
# Served files are the new ones (each pair of hashes must match)
for f in index.html poller.js cloud.js; do curl -s https://china-life.hafrik.com/$f | sha256sum; sha256sum public/$f; done
# Errors since deploy
tail -n 50 /www/wwwlogs/hafrik.com-error_log
```

In the game (browser console, or the Hafrik app): `ChinaLifePoll.mode` must be `'legacy'`. Run the monitor for
15 minutes. The numbers should match the baseline, with no new 5xx errors.

## Step 5: testers

```bash
echo '{"mode":"testers","testers":["hafrik","TESTER2","TESTER3"],"percent":0}' > $API/polling-config.json
nohup /www/server/php/84/bin/php /root/perf-monitor.php --hafrik=/www/wwwroot/hafrik.com \
  --log=/www/wwwlogs/hafrik.com-access_log --interval=60 --csv=/root/perf-rollout.csv > /root/perf-rollout.log 2>&1 &
```

Testers switch within one heartbeat, and `ChinaLifePoll.mode` shows `'adaptive'`. Checklist with two tester phones side
by side:
1. Same venue: each sees the other move within about 2.5 s.
2. Venue chat message and private message: shown on the other phone within about 3 s.
3. Shared activity invite, accept and finish: the reward is paid once on both phones.
4. Home visit invite and accept.
5. Send money to the other tester: it appears within about 3 s when together, about 10 s when apart. Send again while
   the receiver is saving (walking around).
6. Voice in the same venue: connects and stays connected; music in the club keeps playing.
7. Switch the app to the background for a minute and come back: everything catches up at once.
8. Turn the network off and on: the game recovers by itself.

In the monitor, the "pos age together p95" figure should stay at about 3 s or less.

## Step 6: widen

Move to `percent` 10, then 50, then `{"mode":"adaptive"}`. Wait at least one hour at each step, comparing with the
baseline. Move on only if:
- 5xx and 429 errors are not above the baseline;
- PHP-FPM CPU and DB queries/s are falling;
- "together p95" stays at 3 s or less;
- nobody reports a missing message, money or reward.

## Rollback

1. **Immediate, no deploy.** Everyone returns to the old polling within one heartbeat (about 10 s at worst):
   ```bash
   echo '{"mode":"legacy"}' > /www/wwwroot/hafrik.com/api/v4/chinalife/polling-config.json
   ```
   The request rate in the monitor climbs back to the baseline. Counters keep being written, so switching back on later
   is safe.
2. **Code**, restoring the exact files from step 1:
   ```bash
   tar xzf /root/backup/chinalife-files-before-batch1-*.tgz -C /www/wwwroot
   ```
   Then on the development machine, revert the merge on `main`, so the next `update-server.sh` does not bring Batch 1
   back.
3. **Database:** nothing to undo. The migration only added the `chinalife_inbox` table, which the old code ignores.
   Do not restore the database backup unless data was damaged, because that would erase players' progress since the
   backup.
