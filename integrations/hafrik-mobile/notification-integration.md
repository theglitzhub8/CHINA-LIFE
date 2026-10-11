Use chinaLifeNotificationDestination(data, CHINA_LIFE_CONFIG) before normal notification routes in src/helpers/notificationRouting.js (push taps) and before actor/web/post routing in ActivityScreen.jsx (inbox taps). Both return a fixed ChinaLife route and validated launch URL. Changes are applied locally in Hafrik 5.

Mount useChinaLifeAppPresence(token) once in NotificationProvider (context/notificationcontext.tsx). It runs only with authenticated foreground app activity and skips the visible game. Applied locally. Existing push token registration, permissions and delivery configuration are reused.

## Direct notification destinations

Game alerts now include friend acceptance, private messages and shared activity invitations, alongside votes, friend requests and money receipts. App taps use the canonical game inbox link; the authenticated game API resolves the destination from the recipient’s own notification and source record. Requests open Friends, messages open the conversation and scroll to the message when present, votes open the election, receipts open Wallet, and invitations open Together with the existing venue/travel action. Nothing automatically accepts an invitation or moves the player. Deleted, expired, blocked or inaccessible targets remain readable in the inbox. Private message text is omitted from push previews; votes remain anonymous.

Apply the updated `chinaLifeExperience.js` helper to the native app and rebuild/reload it for `chinalife_message` and `chinalife_activity` routing. Both the existing notification tap router and Activity screen already use this helper. Server deployment alone cannot update an installed app. Live device delivery still depends on Hafrik push configuration and device permission.
