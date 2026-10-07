# ChinaLife for Hafrik: reference analysis

Evidence: the 15 supplied Lagos Life screenshots plus public pages inspected on 7 October 2026: https://lagoslife.app/, /privacy, /disclaimer, /advertise, /stats and /terms. Dynamic browser inspection was unavailable; authenticated behavior is inferred only where the screenshots show it. Counts and monetary values in screenshots are displayed values, not independently verified measurements.

## What the reference is building

A persistent social life simulation organized around a city map and shared 3D interiors. The short loop is travel → meet people → perform an activity → change needs, money and skills → return to improve the home. The longer loop is career, property, relationships and social status. An in-game phone turns these systems into recognizable app-sized destinations. Ads and external integrations create an additional discovery layer.

## Screen-by-screen reading

| Reference screenshots | Observed behavior | ChinaLife interpretation |
| --- | --- | --- |
| 1876 | Public city overview, venue pins, signup/login, advertised population, homes and policy banner | Explore the Chinese city before authentication; connect with the existing Hafrik account before entering persistent multiplayer. Use measured population, not fixed marketing numbers. |
| 1877 | Separate login, username/email, password and recovery | Hafrik is the account authority. Native app session is the primary entry; optional manual login for browser users. No separate game password. |
| 1878 | Restaurant interior, NPCs and named player avatars, needs, goal cards, venue composer, activity chips | Chinese food venues and African community kitchens, public-room chat and distinct NPC/player labels. Social interaction is part of the main game loop. |
| 1879, 1880, 1902 | Large phone overlay with apps for jobs, messaging, rides, property, health, wardrobe, money, family and settings | Keep the phone as the system launcher. Existing functional ChinaLife screens already cover jobs, chat, needs, homes, travel, skills, goals and settings. New apps need complete systems behind them. |
| 1894 | Consequence dialog offering fine, timed detention or lawyer | An optional fictional consequence system with clear state, timing and choices; not an essential dependency for fixing multiplayer. |
| 1895, 1896 | Police venue with several named players, chat and activity areas | Shared venues must enforce current-room membership and continually publish each player's position and appearance. Chats belong to the venue; voice is separately opt-in. |
| 1897 | Profile tabs, lifetime dream progress, loan repayment, wishes and perk rewards | Existing needs/skills/dream/career mechanics form the base. Rotating wishes, perks and loans are additional features rather than cosmetic labels. |
| 1898, 1899 | Multiple city tabs, map categories, dense housing, branded billboards and sea advertising plots | Chinese city tabs, useful venue filters, traversable neighborhoods and eventually approved Hafrik partners. Ads require owned content, click handling and a publication workflow. |
| 1900 | Travel sheet with free walking and paid transport alternatives | Transport must disclose fare and duration; charge once on arrival and handle interruption. ChinaLife already tests walking/taxi and intercity flights. |
| 1901 | Home buy mode, floor grid, stored furniture, categories and free replacement of owned objects | Existing furniture catalogue/finishes are a start. Placement, rotation, storage and collision-safe editing are separate work required for comparable home editing. |
| 1903 | Wealth ranking with podium and personal rank | A Hafrik city wealth board needs server-authoritative transactions before it can rank users fairly. Uploaded client money is currently unsuitable for competitive rankings. |

## ChinaLife product direction

Retain the reference's spatial social experience and mobile controls, while using Chinese locations, virtual yuan, Chinese language learning, student/work/creator/entrepreneur paths and Hafrik community venues. Avoid copying the reference's brand assets, exact dialogue or product names. The public disclaimer describes its systems as fictional, including economics, government and law enforcement. ChinaLife should likewise communicate its own game rules precisely.

The present priority is persistent identity and a reliable shared city. Next: improve the venue HUD and inline chat, then home placement and richer daily goals. Later: vehicles, family/staff, additional venues, advertisements and a trustworthy economy with rankings. Payments, gambling and real-world government integrations are not introduced by this repair.

## Architecture implications

- Authenticate on Hafrik; derive the user identity from the server, not the submitted character.
- Restore before setup; one character per account, account-scoped device backups, revision checks across devices.
- Presence includes city, venue, name, outfit, skin, hair and coordinates. Expire inactive users. Count only active sessions.
- Venue chat requires active presence; direct chat requires accepted friendship; blocking applies in both directions.
- Voice identifies both participant and session, isolates signals by room and target session, validates payloads and expires old signals.
- Keep game data separate from real-world money and validate activities on the server before competitive or paid systems are added.

## Repairs delivered in this change

Unified PHP schema and repeatable upgrades; appearance in presence; stable string player IDs; chat authorization/rate limits; friendship, blocking and reports; save conflict protection; voice capacity/session enforcement; Hafrik DJ routes; stale-response rejection and account session restore; maintained automated tests for the current Hafrik integration.

This is a repaired foundation, not complete feature parity with every phone icon in the reference. The list above distinguishes observed behavior from proposed future systems.
