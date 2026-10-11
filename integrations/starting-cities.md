# Starting cities and staged city launches

Character setup is headed China and shows only cities enabled under Admin → Cities. Both inside-China and outside-China players choose a starting city. Students choose a campus available in that city, keep that city in their profile and introduction, and can change campus from their profile. Existing Shenyang student stories and temporary campus profiles are preserved.

Admin can switch Shenyang off and open other supported cities individually. At least one city must stay open. With no stored admin configuration the existing Shenyang default remains; deployment does not change live settings or move existing characters. A first cloud save rejects a closed starting city. Existing characters can still save their progress in a city that admin subsequently closes, but closed cities cannot be selected as new starting cities or travel destinations.

This uses the existing open_cities setting, so no database migration or native app rebuild is needed. China is the country selection screen in this implementation, rather than an additional playable city/map.

The election screen adds office tabs, username/campaign search and real vote totals/percentages on candidate cards. Existing office types, private ballots, one-vote enforcement and own-campaign sharing are retained. No Police/Court system, national office, cabinet, account-age voting restriction or fictional vote counts are introduced. Those require a separate rules/design decision.
