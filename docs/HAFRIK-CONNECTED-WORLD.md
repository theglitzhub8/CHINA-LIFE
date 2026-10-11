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

Update the app's existing ChinaLife wrapper using both files in `integrations/hafrik-mobile/` and build/release the mobile app. The reference was checked against local HafrikAppV2 route names and parameter conventions:

| Destination | Native route | Parameters |
| --- | --- | --- |
| Business | BusinessDetails / BusinessPages | pageId |
| Space | GroupDetails / GroupScreen | groupId |
| Person | UserProfile / PeopleYouMayKnow | userId |
| Course | HafrikXAcademyCourse / HafrikXLearn | id |
| Event | EventDetail / EventsScreen | eventId |
| Product | ProductDetail / MarketplaceScreen | post_id (post ID, not product ID) |
| Exchange | ExchangeHome | none |

The origin/path checks remain enforced; only fixed destination types and positive numeric IDs are accepted. URLs, tokens and caller-selected route names are never sent as navigation parameters. An older wrapper can still use the embedded API views, but native handoff tells the user to update rather than silently losing the tap. This repository contains the wrapper integration source; an actual mobile build is still required.

## Verification

Automated client tests exercise the seven integrations, pending joins, explicit follows/RSVP, course application, server quote, marketplace post IDs, pagination, escaping, duplicate sends, account changes and map merging. PHP/MySQL tests exercise the real projection/placement SQL, ownership/co-admin/admin checks, hide overrides, title updates, deleted/expired/secret records, method/auth restrictions and CORS. Bridge dispatch tests stub the installed Hafrik workflows; they do not certify production modules. World tests verify stalls, focusing, label updates and removal.

After deployment, verify with two test Hafrik accounts: compare a business name change; follow it; join a public Space; request a private Space; confirm pending membership; apply for a course; RSVP to an event; load a product and quote; compare order history with Hafrik. Check a normal user cannot move another owner's listing. Then check each native handoff in the rebuilt app. No production account actions or financial transactions were performed during development.
