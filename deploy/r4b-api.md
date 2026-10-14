# R4b API changes (staging-tested, not live)

Files (all in api/v4/chinalife):
- cache-lib.php (new): cl_cache(key, ttl, fn) uses APCu when loaded, else JSON files in /dev/shm/chinalife-cache.
- online.php: online counts cached 10 s.
- leaderboard.php: top-50 list cached 30 s (your position stays live).
- hafrik-map.php: map pins per city cached 60 s; any placement (POST) clears the cache.
- feed.php: the shared-activity catalog (~15 KB) is skipped when the client sends ?catalog=<hash> and it matches.

Not cached: coins, balances, saves, events (per-player "joined"), presence, music, messages.
APCu is not installed on PHP 8.3 or 8.4 here, so the /dev/shm file cache is what runs.
Disable instantly: set CL_CACHE_OFF=1 in the PHP-FPM env, or restore the backup.

Deploy (with the usual routine: backup, md5 check vs live, cat > in place):
  live md5 before R4b: online d13c0b05, leaderboard e38a0857, hafrik-map eabca8c4, feed 9fb29cd0
  F=/www/wwwroot/hafrik.com/api/v4/chinalife
  cp chinalife-api/cache-lib.php $F/ && chown --reference=$F/common.php $F/cache-lib.php && chmod --reference=$F/common.php $F/cache-lib.php
  for f in online leaderboard hafrik-map feed; do cat chinalife-api/$f.php > $F/$f.php; done
  rm -rf /dev/shm/chinalife-cache   # staging may leave a root-owned dir; FPM (www) must create it
  Smoke test: curl -D- .../online.php twice with a token -> X-CL-Cache: MISS then HIT.
Front end and API are compatible in any order: old clients get the full feed, new clients work with the old feed.
