# Hafrik connected world

ChinaLife displays Hafrik's live records and sends account actions to Hafrik's existing API. It does not create duplicate business/community accounts, friendships, courses, event attendance or orders.

## Phone and map

The phone's Hafrik group contains Businesses, Spaces, Exchange, Meet People, Learning Hub, Hafrik Events, Marketplace and the previously implemented Services app.

- Businesses: browse/search/pages, following, real business page, owner/co-admin map placement.
- Spaces: browse/search/joined/managed lists, details, one-tap join for public Spaces, pending requests for private Spaces, leave/cancel, owner/co-admin placement. Visiting never joins automatically. Secret Spaces are excluded from map projections.
- Meet People: search Hafrik profiles, explicit follow/unfollow, open real profiles. No physical location upload or game friendship is created.
- Learning Hub: course catalog, application, progress/application status and lesson titles. Continue the actual course in Hafrik's native Learning Hub. Premium/locked lesson access is retained. Course placement is admin-only.
- Events: upcoming listings, details, going/interested/clear RSVP; open the original event. Events with an unambiguous ChinaLife city in their location get a map stall. Owners/admins can set placement. Expired/secret events disappear from the map.
- Marketplace: live product listings, search, pagination, detail, real currency/stock/seller, open the product in Hafrik to buy/contact the seller. The existing commerce flow handles cart/checkout/payments.
- Exchange: the current `exchange/` module's active rates, server quote (fees/min/max), account order history; continue order creation/payment/payout in the native Exchange screen. Browser users get the Hafrik app link. Quotes use GET and do not call the older HafrikX `convert.php`, which writes transactions. No game money is used.

Seven Hafrik access stalls per city reuse the approved 1.7× partner stall model near existing venues. Linked real business/Space/event/course records also reuse partner stalls and map search. No city geometry, streets, landmarks, lighting, HUD, dock or existing building style is changed. `world.js` only gains focusing a partner by ID and refreshing labels when source content changes.

Business addresses are recognized only when they contain exactly one known city (English whole word or Chinese city name). Ambiguous/unspecified cities stay available on the phone without guessed map placement. An owner can use **My listings → View details → Set ChinaLife map location**. The setting supports seven shared public venue anchors and explicit hide. Admins can place any supported listing. One source record has one city placement in this release.

Only `source`, Hafrik ID, city, nearby venue, active flag and update audit fields live in `chinalife_hafrik_places`. Explicit placement (including hide) overrides inferred addresses. Source IDs are namespaced to avoid collisions with ChinaLife's existing partners. Content is fetched live on opening/refresh; map data refreshes once a minute while visible and on account/city changes. This is polling synchronization, not instant push. Each projection query is bounded to 100 records; the phone supports pagination for larger catalogs.

## API bridge

`hafrik.php` dispatches only fixed read/account-action routes, authenticates first, restricts methods, rate-limits mutations and serializes repeated account actions. Its output buffer reapplies ChinaLife credentialed CORS after upstream module headers. Existing Hafrik notification and permission behavior is retained.

`hafrik-map.php` reads source tables directly for current projections and validates listing ownership/admin rights for placement. Missing source modules do not hide the other features. A failed map request clears imported records while retaining the phone access stalls. Client async results are discarded on account/city changes; imported map rows clear on sign-out. Account-specific integration screens close on an account switch.

## Server deployment

Use the established release checkout and branch:

```bash
cd /www/chinalife-security-release &&
git fetch origin release/security-politics &&
git merge --ff-only origin/release/security-politics &&
./scripts/check-hafrik-integration.sh /www/wwwroot/hafrik.com &&
./scripts/deploy-php.sh \
  /www/wwwroot/hafrik.com \
  /www/wwwroot/china-life.hafrik.com/public &&
/www/server/php/84/bin/php /www/wwwroot/hafrik.com/api/v4/chinalife/migrate.php
```

The migration is required for the new placement-only table. It is repeatable and preserves existing records. The frontend deploy does not install or change Hafrik's existing API modules. The preflight checks endpoint-file availability, not database schema or successful authentication.

## Mobile handoff

Update the app's existing ChinaLife wrapper using both files in `integrations/hafrik-mobile/` and build/release the mobile app. The reference was checked against local Hafrik 5 app route names and parameter conventions:

| Destination | Native route | Parameters |
| --- | --- | --- |
| Business | BusinessDetails / BusinessPages | pageId |
| Space | GroupDetails / Groups | groupId |
| Person | UserProfile / PeopleYouMayKnow | userId |
| Course | HafrikXAcademyCourse / HafrikXLearn | id |
| Event | EventDetail / EventsScreen | eventId |
| Product | NativeMarketplaceProduct / MarketplaceScreen | productId (Hafrik post ID, not WooCommerce ID) |
| Exchange | ExchangeHome | none |

The origin/path checks remain enforced; only fixed destination types and positive numeric IDs are accepted. URLs, tokens and caller-selected route names are never sent as navigation parameters. An older wrapper can still use the embedded API views, but native handoff tells the user to update rather than silently losing the tap. This repository contains the wrapper integration source; an actual mobile build is still required.

## Verification

Automated client tests exercise the seven integrations, pending joins, explicit follows/RSVP, course application, server quote, marketplace post IDs, pagination, escaping, duplicate sends, account changes and map merging. PHP/MySQL tests exercise the real projection/placement SQL, ownership/co-admin/admin checks, hide overrides, title updates, deleted/expired/secret records, method/auth restrictions and CORS. Bridge dispatch tests stub the installed Hafrik workflows; they do not certify production modules. World tests verify stalls, focusing, label updates and removal.

After deployment, verify with two test Hafrik accounts: compare a business name change; follow it; join a public Space; request a private Space; confirm pending membership; apply for a course; RSVP to an event; load a product and quote; compare order history with Hafrik. Check a normal user cannot move another owner's listing. Then check each native handoff in the rebuilt app. No production account actions or financial transactions were performed during development.

## Hafrik visual system and native app continuity

Connected panels now use Hafrik 5's canonical tokens from `src/theme/colors.ts`, `palettes.js` and `typography.ts`: Java `#1F8E93`, Cyprus `#0C3F44`, canvas `#EDF7F5`, white surfaces and Readex Pro. Regular and semibold fonts are bundled in `public/hafrik-fonts.css`; their SIL Open Font License is in `docs/Readex-Pro-LICENSE.txt`. No external font request is needed. Event cards use cover images, calendar badges and actual dates/location/attendance. Businesses, Spaces, people and Academy share the same card hierarchy; services, Marketplace and Exchange share the panel, action and form styling. Theme rules apply only to Hafrik integration panels. Other game panels retain their own style.

The wrapper follows the app's resolved light/dark theme. A native “Hafrik apps” menu pushes fixed app routes above the ChinaLife screen; Back returns to that existing game instance. It includes the Hafrik feed, businesses, Spaces, people, events, learning, Marketplace and Exchange. The feed opens the normal Hafrik tabs without a second stack header. Register MainTabs in App.js with:

```jsx
options={{ gestureEnabled: false, headerShown: false }}
```

The existing feed owns its safe area and floating header. Adding a stack header
above it produced extra vertical space. The Home feed card above stories now
shows the signed-in player’s saved game clock and mood inside the existing CTA, alongside its displayed online count (actual online × 49). Game balance is only shown in the game. There is no separate stats block underneath. Tap it to
return to ChinaLife; the normal Hafrik tabs remain available. Values are marked
as last synced and never drawn from another account’s cache. The card refreshes
on focus, app foreground and every minute while active. No extra API or database
migration is required. These changes are applied locally in Hafrik 5. Ship the
updated ChinaLifeLiveCard/chinaLifeExperience and MainTabs options with the app;
server deployment alone cannot change native spacing or display the stats.

Trusted focus messages save the current game and release voice/microphone, radio and club audio when the game is covered or the app backgrounds. Rendering pauses without rebuilding the city or resetting the character. Returning reenables rendering and refreshes the connected map data. Audio stays paused until the user plays again; voice can resume its normal listen-only behavior, with microphone use requiring the existing explicit action. The only city renderer edit is the early rendering pause guard; map appearance and layout are unchanged.

Recommendation: retain this native-shell/web-renderer architecture initially and benchmark load time, frame pacing, battery use and return behavior on actual iOS/Android devices. Expo GLView offers a possible later native 3D renderer: https://docs.expo.dev/versions/latest/sdk/gl-view/. A port would require replacing the current DOM dialogs, labels, input and asset-loading assumptions, while keeping the existing Hafrik authentication and backend. It is a separate engineering phase, not a WebView configuration change. Current automated checks cover the trust boundary, routes, account isolation and focus behavior; a physical-device build/navigation/audio check is still needed.

## Home launch experience and milestone sharing

The native app's Latest/Home feed now begins with `ChinaLifeLiveCard`. This replaces reliance on a rotating banner or an entry far down the feed: the card is visible at the start of Home, uses Hafrik's brand, checks real `/chinalife/online.php` availability/counts and reads the authenticated `/chinalife/save.php` to offer “Continue playing” with the saved city. Save account identity must match the current app account. Unavailable/invalid counts never produce a LIVE badge or invented player numbers. Refreshes run only while the Home tab/app is active; requests abort on blur/account changes.

When the game is reachable, a first-visit announcement explains ChinaLife and offers “Enter ChinaLife” or “Continue browsing Hafrik”. Dismissal is remembered per account and configured origin (including within the running session if storage fails). It is an in-app introduction, not a broadcast push notification. The app continues to open Home, where users see the game entry; playing is their explicit choice. Existing banner/sidebar/contextual entries still work.

Native files are already applied locally in Hafrik 5. For another checkout, copy `ChinaLifeLiveCard.jsx`, `chinaLifeExperience.js` and the updated wrapper/config from `integrations/hafrik-mobile` to `src/pages/chinaLife`. Import the live card in `UnifiedFeedScreen.jsx` and prepend `<ChinaLifeLiveCard active={isActive} />` to the Home feed's existing `ListHeaderComponent`; preserve that existing header. The wrapper imports the shared Zustand store to open the normal composer and pauses the game while the composer is visible.

The game's rank screen now offers “Share your milestones on Hafrik”. The first release covers earned ranks, game certificates and the currently completed night mission set. It opens an achievement picker; choosing Share sends only bounded kind/title/city metadata to the trusted native wrapper. The wrapper creates a text draft using the configured public game URL, ignoring caller URLs, audiences and target profiles. The user edits the text, selects their normal publishing target/audience and presses the composer's own Publish action. Sharing does not automatically post anything, create a second posting API or imply independent verification of an in-game achievement. Duplicate bridge requests cannot replace an already open composer draft. The game remains underneath the composer and resumes on dismissal.

Server pull/deploy publishes the milestone picker/bridge. The Home live card, one-time announcement and native post drafts require reloading the development app or shipping an updated Hafrik app. No new database migration is required for this change. Device verification should cover first-visit/later-visit welcome behavior, saved/new players, offline counts, returning from the game, composer cancel/publish, and account switching.

Shared posts' canonical game links render as `ChinaLifeSharedLink` inside the native `LinkPreview` component. This opens the existing ChinaLife route directly. The detector accepts only the configured HTTPS origin and exact game mount path; lookalike hosts, credentials, unexpected ports, queries and other Hafrik pages retain the ordinary link handling. Copy `ChinaLifeSharedLink.jsx` with the other native bridge files, then check `isChinaLifeLaunchLink(cleanUrl, CHINA_LIFE_CONFIG)` before the generic/media link cases in `LinkPreview.jsx`. This is already applied to the local app. Older native wrappers without the sharing capability show an update prompt when the game Share button is tapped.

### Election campaigns
The Politics ballot explicitly lets any signed-in player vote for any approved
candidate, without submitting a nomination. Each office permits one vote per
account per election. Own approved candidates have an “Ask for votes on Hafrik”
button while polls are open. It opens an editable native Hafrik text draft with
the office, city and trusted campaign link. The link opens the candidate’s city
ballot and marks their card without moving the character, casting a vote or
publishing. Closed/unavailable candidates show a message. Login is required.
The native `chinaLifeExperience.js` update must ship with the app for campaign
drafts to work. No database migration or map appearance change is needed.

Campaign links use only `#view=voting&city=…&candidate=…` on the configured game
URL. The native link preview passes a validated launch URL to ChinaLifeScreen;
the campaign opens a fresh game document with the existing saved character.
Update ChinaLifeSharedLink, ChinaLifeScreen, chinaLifeExperience, and the native
LinkPreview call to `<ChinaLifeSharedLink url={cleanUrl} />` when shipping.

### HQ multiplayer venue correction
Hafrik HQ (`hq`) and the Civic Hall (`voting`) must be accepted by `cl_room` in
common.php. Their missing IDs rejected presence updates and prevented voice from
joining those rooms. Both IDs now use the existing authenticated presence and
voice checks; invented venues remain rejected. Deploy the PHP update; no schema
migration or map change is needed.

The redesigned ChinaLifeSlide uses Readex, Hafrik teal and a gold vector city.
In banner.jsx apply the native slide integration in
`integrations/hafrik-mobile/banner-native-slides.js`: after the lead banner,
ChinaLife comes second and before the study slide. Remaining API banners keep
their order; duplicate game actions collapse to one redesigned native slide.
With no API banners the fallback remains Study, ChinaLife. The native CTA uses
`chinaLifeActivityCount`, multiplying only the displayed count by 49. The server
presence and voice counts keep their existing logic. Ship the updated banner.jsx,
ChinaLifeSlide, ChinaLifeLiveCard and chinaLifeExperience with the native app.

### Continuous weekly voting and native sign-in
Politics now ensures missing weekly elections when a ballot loads or a vote is
cast. Weeks run Monday 00:00 through Sunday 23:59:59 Beijing time. Active or
future admin schedules are preserved; active custom elections take priority.
Old votes remain attached to their election period. Non-candidates can vote for
any approved candidate once per office, and the returned ballot updates totals.
No migration or cron task is required.

Player profiles expose “View Hafrik profile”: the app opens the fixed UserProfile
route with the verified numeric account ID; browsers open the profile username
on hafrik.com. AI residents do not get this action.

ChinaLife receives the native token directly through its existing session bridge.
The general useWebViewSession helper uses a token-bearing redirect URL and is
not needed here. The cloud login fallback is now deferred while the native
session connects. It appears after the eight-second missing-session timeout or
a connection error, rather than flashing during a normal session restore.

### HQ services, labels and native notifications
HQ’s general services entry now opens the same live Hafrik Services catalogue as
the phone. Staff desks link to that catalogue; CEO appointment and careers flows
remain separate. The Send Money screen shows the available balance without the
old disclaimer line. Inside HQ, short names appear over staff and role plaques
sit on their desks. Only that HQ label line in world.js changed; city layout,
map appearance and all other rooms are preserved.

Votes, new friend requests and successful transfers call the installed Hafrik
`notifications/_admin_notify.php` helper. It creates normal Hafrik inbox rows,
increments the normal badge and uses the existing device push provider.
Transfer retries and repeated pending friend requests do not create duplicates;
vote notices use a system sender and do not disclose the voter. Failed push
integration is logged and does not reverse a successful game action. Device
push depends on existing provider configuration, permission and registered
user tokens. These were not exercised against production devices here.

Native push and Activity inbox taps use chinaLifeNotificationDestination to
open the configured game with a bounded notice key. The game has a Phone →
Notifications app and highlights the tapped alert. game-notifications.php reads
only the authenticated recipient’s rows and marks only their alerts as read.
Ship the changed native notificationRouting.js, ActivityScreen.jsx,
NotificationProvider hook, useChinaLifeAppPresence and chinaLifeExperience.
See notification-integration.md for the targeted integration points.

useChinaLifeAppPresence keeps saved players online every 15 seconds while the
native app is foregrounded. It skips the visible game, which owns movement
heartbeats. app-presence.php preserves existing positions and private-home
access checks. Backgrounding stops the native heartbeat and normal presence
expiry applies. This is active-app presence, not an always-online claim after
OS suspension. No database migration or new notification credentials required.
Preflight now requires the installed Hafrik notification and push helpers.
