# Weather, election rankings and Cantaball update

Deploy from the combined release worktree, keeping the politics feature:

```bash
cd /www/chinalife-security-release &&
git fetch origin release/security-politics &&
git merge --ff-only origin/release/security-politics &&
./scripts/deploy-php.sh \
  /www/wwwroot/hafrik.com \
  /www/wwwroot/china-life.hafrik.com/public &&
/www/server/php/84/bin/php /www/wwwroot/hafrik.com/api/v4/chinalife/migrate.php
```

The migration is required. It preserves existing votes, associates legacy votes with their matching election (or a legacy period), and replaces the lifetime voting limit with one vote per account, city, office and election period. It is safe to run again. Make the normal database backup before deployment; do not roll the database back after new votes arrive.

Weather is simulated game weather, not a live forecast. Everyone in a city now gets the same weather for the Beijing calendar date, independent of their character's age. Snow is limited to northern cities in October through March. The approved two-hour shared sky cycle, city geometry, camera, lighting palette and map layout are preserved. The Phone's weather label follows that sky; clocks and dates use Beijing time. Indoor venues have no rain or snow particles. Reduced-motion mode suppresses weather particles.

Check two accounts in the same city: approve two nominees, open an election, cast votes, compare rankings, and confirm a second vote in the same office is rejected. Gist's Elections filter shows approved nominees, current vote totals and anonymous vote activity. A later election starts from zero without deleting previous votes. Tied candidates share a rank. Gist refreshes every 15 seconds while open for signed-in players.

Cantaball loads directly in a bounded game frame. Test Tap to Start → Vs Computer → Kick off, then Reload and Close. Full screen depends on browser support; Open separately remains available. The external game's availability and online multiplayer remain controlled by its host.
