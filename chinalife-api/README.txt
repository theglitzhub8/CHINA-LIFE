Install this folder as /api/v4/chinalife/ alongside existing Hafrik db.php and helpers.php.
After deployment, run: php /path/to/hafrik/api/v4/chinalife/migrate.php
The repeatable migration handles fresh installations and upgrades without deleting saves.
See ../DEPLOYMENT.md in the source repository for deployment, native session integration and verification.
Legacy migration.sql, migration 2.sql and voice.sql are historical files; use migrate.php for upgrades.
