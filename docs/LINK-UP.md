# Link Up (one-city People tab, Oct 2026)

In one-city mode the People tab is now called **Link Up**. It is built around the seven places. In Classic it is still **People**, with Nearby, Chats, Friends and Venue as before.

## Tabs (one-city)
- **Places** (first). It shows:
  - Join / log-in banners.
  - **Happening now**: the live hot seat (Vote), open football matches (Join), tournaments that are registering (Join) and friends online (Go).
  - The seven places as live rows. Each row has the player count from presence, *You're here*, the live status (hot seat live, open match, friends here), opening hours, and Join/Go, which travels the same way as Where to? (`ChinaLifeWhereTo.go`).
  - Tap a row to see who's there (place view). From there: Go, Chat here, Play a match, Hot seat.
  - Empty sections are hidden.
- **Chats** and **Friends**: unchanged.
- **Venue chat** is no longer a tab. Open it from the venue card's 💬 *Venue chat* button, or from *Chat* on your own place row. The code is unchanged (`view='venue'`).

## Profiles
Profiles now show a football record (played, won, titles) and hot seat calls (right / total). These come from new optional `football` and `hotSeat` fields in `profile.php`. If the fields are missing, the record is hidden.
- Hot seat counts only the user's votes on revealed gists that matched the verdict. It never counts authorship, so gists stay anonymous.
- *Go there* travels to the player's place.
- Add friend, Chat, Wave, Invite to my venue and Report/Block are unchanged.

## Admin switch
`legacy_people_nearby` is in the Hafrik features list (`chinalife-api/hafrik-features.php`). It is **off by default**.
- When on, the old Nearby screen comes back as a tab in one-city: map pins, on the street, residents, the *Simulated city characters* button and the live feed. Nothing was deleted.
- The appadmin Features tab reads the labels from the API, so the switch appears there by itself.
- For testing, setting localStorage `chinalife-flags-on` to include `legacy_people_nearby` also turns it on.

## Data used (existing APIs only)
- presence (`ChinaLifeCloud.cityPlayers`) and social.php (friends)
- `ChinaLifeFootball.summary()`: one lobby GET
- `ChinaLifeHotSeat.peek()`: same GET as the hot seat

`loadHappening` is throttled to once every 12 s while Link Up is open.

Tests: `tests/link-up.mjs`.
