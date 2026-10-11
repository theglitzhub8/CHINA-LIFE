# Hafrik integration controls

Open Admin → Hafrik integrations in the full dashboard or the in-game admin panel.
Eight switches control Businesses, Spaces, Meet People, Academy, Events, Marketplace,
Exchange and Services. Three additional switches control synced map locations,
campaign/milestone sharing and outgoing Hafrik inbox/device alerts.

All switches default to on, preserving existing behaviour. They are stored in the
existing chinalife_settings table under hafrik_features; no new migration is needed.
Only server-authorized admins can change them, and changes appear in the admin audit
log. Updates are partial and serialized so concurrent changes to separate switches
are retained.

Game API actions check the switches immediately. Active clients receive settings via
the normal events refresh (45 seconds) and map sync (60 seconds). Disabled phone apps
and synced map stalls are hidden. Services controls are hidden at HQ, while staff
reception remains available. Switching off does not delete Hafrik data, applications,
map placements, game votes or previous notifications. The switches do not disable
Hafrik's standalone app or website. Alerts already queued with a push provider cannot
be recalled. Re-enable a feature to make it available again.
