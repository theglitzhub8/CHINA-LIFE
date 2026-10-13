# R1 deploy notes (not deployed yet)
1. Front end: run `node scripts/build-r1.mjs` (edit `public/index.dev.html`, never the generated `public/index.html`). Copy `index.html`, `flags.js`, the 4 hashed bundles and the changed source files (lazy: `cabin.js`, `weekly-admin.js`).
2. Cache: hashed bundles may be cached for a year. Add to the china-life vhost or .htaccess:
   `<FilesMatch "^(core-[ab]|app|styles)\.[0-9a-f]{10}\.(js|css)$">Header set Cache-Control "public, max-age=31536000, immutable"</FilesMatch>`, with `index.html` set to `no-cache`.
3. API (additive): `feed.php` (new), plus `common.php` (cl_reply, cl_fail in feed mode, cl_song_file), `online.php`, `golden.php`, `events.php` and `activities.php` (GET reply via cl_reply). No schema change.
4. Music: copy `/root/r1-music/*.m4a` (www:www 644) into `/www/wwwroot/hafrik.com/chinalife-music/`. Keep every `.wav` original. Install `deploy/chinalife-music.htaccess` as `chinalife-music/.htaccess`. Songs switch to the `.m4a` automatically when the file sits next to the `.wav`.
5. To turn a feature back on, remove it from `public/flags.js` (or set localStorage `chinalife-flags-on` for testing).
