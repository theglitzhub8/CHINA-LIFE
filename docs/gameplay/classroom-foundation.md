# Classroom foundation status

The initial `public/gameplay/controller.js` is a pure fixed-step module for local/client and future room-server reuse. It supports bounded walking/running, normalized diagonal input, horizontal collider sliding, jump/landing, jump-button edge detection, platform-top landing, seated movement suppression, safe standing exits and idle/dance/wave animation states. It currently uses static circle/box clearance and floor/platform support; moving platforms, ceiling collision and full character rig blending remain work for the classroom slice.

It is not imported into the existing game yet. There is no live classroom, perspective camera, seat authority or synchronized quiz in this release. Existing maps, avatars, saves, presence and gameplay are unchanged. Seat poses must only be applied after an authoritative seat lease is granted; the controller does not grant that lease.

The owner uses BaoTa/aaPanel. Before selecting/installing a supervised room service, collect the read-only server check:

```sh
cd /www/chinalife-security-release &&
git fetch origin release/security-politics &&
git merge --ff-only origin/release/security-politics &&
bash scripts/check-classroom-host.sh
```

No PHP/static deployment is necessary for this inactive foundation. The check reports available Node/nginx/process-manager tooling but does not prove WebSocket support. The next infrastructure step must verify a secure reverse proxy and a supervised room process, then connect Hafrik-authenticated room tickets and demonstrate two clients. No daemon, firewall rule, credentials or production server settings have been changed by this work.
