# Club and radio update

The approved city map is unchanged. Club interiors now have quieter character labels, a larger song screen, and a bold elevated 007 sign. VIP purchases automatically walk the player to the lounge; unpaid movement cannot enter its reserved area. Paid guests have a VIP badge, derived from their saved pass in presence responses.

Use the bottom venue actions to change/request music or play with people. Real players in the same club can invite one another to dance or play dice for 50, 200, or 1,000 virtual coins each. Both must accept, become ready, and roll. The server rolls and settles only when both remain present and have sufficient funds. Ties cost nothing. Cancellation takes no coins. Settlement is atomic and idempotent.

Spraying is a gift to a real player in the same club. It uses the existing authenticated, atomic transfer mechanism and broadcasts its visual through the existing presence feed. Retrying the same request cannot pay twice. Virtual residents cannot receive coins. There is no new background polling loop for spraying.

No database migration is required for this update.

## Audio and a future standalone app

Radio audio is attached to the document, opts into a playback audio session where supported, and supplies media metadata/playback/seek controls. Minimizing its panel does not stop playback. Browsers and embedded WebViews can still suspend audio when switching apps or locking the phone; this update does not guarantee playback after backgrounding or closing the app.

A standalone React Native app is feasible. Start with native navigation, authentication, notifications, and a native audio player, keeping the approved Three.js city in a WebView. Use a narrow, validated bridge for track metadata and play/pause requests; the native player must own background playback and lock-screen controls. Keep the existing authenticated PHP API. Port other screens gradually. A WebView wrapper alone does not provide reliable native background audio.
