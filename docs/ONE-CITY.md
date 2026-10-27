# One-city mode and "Where to?" (Oct 2026)

The founder's spec, 27 Oct 2026: one country (China), one city, and seven places (Club, Gossip Room, Voting Booth,
Football Pitch, Hafrik HQ, Hospital and University). Other cities are switched off from admin, and the city map is
replaced by a **Where to?** screen. **Nothing is deleted.** Every other city, venue, the map view and flights stay in the
code and come back when an admin switches the layout to **Classic**.

## Active city
`China` (中国 · ChinaLife Central). It is already the default open city (`cl_open_cities()` and `activate-china.php`).
It uses Shenyang content, so all seven venues already exist there.

## The seven destinations (existing venue ids, no new venue code)
| Destination | Venue id | Code |
|---|---|---|
| Club | `night` (007 Club) | game.js `night` venue, club flow (`clubOpen`, club-host) |
| Gossip Room | `gist` (China Gossip Center) | game.js `gist`, gist.php, gist-night |
| Voting Booth | `voting` (ChinaLife Voting Booth) | voting-centre.js, elections.php. The `politics` flag in flags.js is still OFF, so ballots stay paused until the founder decides. |
| Football Pitch | `football` (Football Field) | game.js `football` venue |
| Hafrik HQ | `hq` | hq.js |
| Hospital | `cityhospital` (City Hospital) | game.js `cityhospital` |
| University | `university` (ChinaLife University) | school.js, `universityIds` |

The opening hours (game time) and card copy are in `public/one-city.js` (`PLACES`).

## How it is switched
* **Cities** still use the existing `open_cities` setting (admin → Cities). Keep only `China` ticked.
* **World layout** is a new row, `chinalife_settings.world_layout`, with JSON
  `{"mode":"one-city"|"classic","city":"China","places":[…],"where_to":true,"flights":false}`.
  * In admin it is under **Cities → World layout**, in both the in-game admin screen and admin.html.
  * The admin.php actions are `world_layout` and `set_world_layout`. They are validated by `cl_valid_world_layout()`, use the same locked update as other settings, and write to `admin_log`.
  * `events.php` sends `world_layout` to every client, and cloud.js applies it with `ChinaLifeOneCity.set()`.
  * When the row is missing, the API sends `null` and the client keeps its built-in one-city default.
* **Migration:** `chinalife-api/migration-world-layout.sql` (INSERT IGNORE, so it never overwrites an admin choice).
  `migrate.php` picks it up automatically. **Not run on production yet.** When approved, run:
  `/usr/local/lsws/lsphp84/bin/php /home/hafrik.com/public_html/api/v4/chinalife/migrate.php`

## What one-city mode does (and what it only hides)
* Venues outside the layout are hidden through `ChinaLifeFlags.placeOff` (map pins, lists and search). A player's
  home, campus, job venue and current place stay visible, as before. Travelling to a hidden venue shows
  "That place is closed for now".
* **Saves in a disabled city** move to the active city on load (`ChinaLifeOneCity.relocate`). The old values are kept
  in `cityBeforeOneCity` and `placeBeforeOneCity`, and `validateSave` keeps them, so the move can be undone.
* **Flights:** `tripScreen` and `airportScreen` show "Travel between cities is paused" while `flights` is false.
* **Map:** the Map button becomes **Where to?**, and leaving a venue opens the Where to? board instead of the street
  map. world.js and the map markup are unchanged; Classic mode restores the original button and its handler.

## Where to? screen (`public/where-to.js`, `public/where-to.css`)
* **Suggested for you** shows up to three cards from `ChinaLifeOneCity.suggest()`:
  * low energy, hygiene or hunger → Hospital;
  * friends online → Gossip Room;
  * class time (08–12, 14–17) → University;
  * 16–21 → Football Pitch;
  * 20–03 → Club;
  * an open election → Voting Booth;
  * places with 3 or more people → that place.
  * Closed places sink to the bottom.
* **All destinations** shows a card for each of the seven places: icon, name, short line, Open/Closed with hours by game time, and people there now (when signed in and presence is live).
* Tapping a card uses the normal travel flow (`ChinaLife.travel` → ride sheet → journey).
* Colours are Honeydew #F7FFF7, Hafrik Black #121212, Java #1F8E93 and Cyprus #0C3F44, in Work Sans. The layout is mobile first.
* It is a single list of destination cards with a suggestion row. It deliberately has no city tabs, map categories or travel-sheet look (see REFERENCE-ANALYSIS.md).

## Private previews run offline
Any copy served under a `/preview-*/` path sets `window.ChinaLifeSandbox` (in one-city.js):
* There is no Hafrik login and `ChinaLifeCloud.api()` refuses every call, so the preview never reads or writes `save.php`.
* Saves go to localStorage under `chinalife-preview:…` keys, separate from the live game's keys on the same domain.

So a preview can never change a real save. Presence counts and friends are therefore empty in a preview.

## Restore everything
Go to admin → Cities → World layout → **Classic** (or tick more cities). Nothing else is needed, and no code has to change.
