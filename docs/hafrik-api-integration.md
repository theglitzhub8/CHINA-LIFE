# Hafrik API integration audit

Source: `/Users/mac/Documents/hafrik script/api/v4`, inspected 2026-10-11. This is a local source inventory, not certification that every endpoint is deployed or working. No credentials or production user data were read.

## First integration: Services

ChinaLife phone → **Hafrik Services** → active catalog → service-specific application form → confirmation/reference → My applications → staff update.

Uses Hafrik's existing `hafrikx_services`, `hafrikx_service_fields`, `service_applications` and application log/notification workflow. These applications appear in Hafrik's existing service admin, not ChinaLife's separate HQ inbox. Existing HQ desk requests retain their own workflow.

- `services/list.php`: active services, prices, processing times and configured form fields.
- `services/detail.php?id=…`: fresh service definition before applying.
- `services/apply.php`: authenticated submission with `service_id`, `full_name`, `phone`, optional `email`, and `payload` keyed by configured `field_key`; server validation, application reference, admin notification.
- `services/my_applications.php`: signed-in user's applications.
- `services/get_application.php?id=…`: ownership-filtered application and staff note.
- `services/admin/*`: existing service/field/settings management and application review.

All configured field types are supported: text, textarea, email, phone, number, date, URL, select, radio and checkbox (array values). Descriptions are displayed as escaped text. Submission locks while pending; field errors retain the form. Catalog and application results are discarded after an account change. No game currency, rewards or payment processing are attached to real applications.

`chinalife/hafrik-services.php` restricts dispatch to these five actions, enforces methods/authentication, rate-limits submissions, and includes the existing sibling `services` scripts. It uses ChinaLife's trusted-origin credentialed CORS rather than the upstream wildcard. A read-only live check of `services/list.php` returned HTTP 401 with wildcard CORS; no signed-in live submission was performed.

## Other custom application and commerce APIs

| Module | Existing workflow | Integration considerations |
| --- | --- | --- |
| Universities | Programs, dynamic fields, application submission/history/detail | Separate program IDs; deadline and document-upload validation. Requires its own flow. |
| Jobs | Listing/detail/categories, applications, apply | Employer job IDs/post IDs, experience, employer questions and CV. Separate from game jobs. |
| HafrikX academy | Courses/detail, apply, progress | Application records course interest and unlocks learning content; distinct course enrollment flow. |
| HafrikX sourcing | Request, request history/detail | Trade sourcing requests; different request payload. |
| HafrikX shipments/orders | Tracking, shipments, warehouse, orders | Real commerce and delivery tracking, separate from game inventory. |
| Marketplace services | Service listings/detail and service_request | Requests create service orders and can message the seller; different from Hafrik-managed service applications. |
| Exchange / HafrikX exchange | Rates, conversion, orders, receipt/QR upload and history | Real financial workflow; do not connect to fictional ChinaLife money. |
| Explore services | Discovery/admin listings | Discovery content, not the managed Services application API. |

## Deploy and verify

Deploy this repository's frontend and `chinalife-api/hafrik-services.php` using the existing deployment scripts. Hafrik's existing `/api/v4/services/` module must be present alongside `/api/v4/chinalife/`. This change adds no ChinaLife database migration; the existing Services module manages its own schema.

After deployment, use a test Hafrik account in both the browser and Hafrik app: open Phone → Hafrik Services; verify configured fields; submit one agreed test application; confirm the reference and entry in Hafrik service admin; add a staff note and confirm it appears in My applications. Verify a second account cannot see that application. Live authenticated end-to-end verification remains outstanding.

The city map appearance and layout are unchanged. `index.html` only adds a script; `game.js` only adds a phone app entry, its icon color and group placement.

## Complete v4 module endpoint inventory

Includes PHP helper/admin files for completeness. Older v1/v2/v3 versions and zip backups were located but v4 is the existing ChinaLife authentication base and the integration target.

### admin (24 PHP files)

- `admin/ads.php`
- `admin/analytics.php`
- `admin/dashboard/overview.php`
- `admin/home/banners.php`
- `admin/home/quick_links.php`
- `admin/marketplace/_core.php`
- `admin/marketplace/banner-delete.php`
- `admin/marketplace/banner-save.php`
- `admin/marketplace/banner-toggle.php`
- `admin/marketplace/banner-upload.php`
- `admin/marketplace/banners.php`
- `admin/marketplace/dispute_resolve.php`
- `admin/marketplace/disputes_list.php`
- `admin/marketplace/order-details.php`
- `admin/marketplace/orders.php`
- `admin/marketplace/update-order-status.php`
- `admin/marketplace/verification_review.php`
- `admin/marketplace/verifications_list.php`
- `admin/payment/manual-methods.php`
- `admin/session_token.php`
- `admin/sngine_products.php`
- `admin/system/_core.php`
- `admin/system/status_get.php`
- `admin/system/status_save.php`

### ads (8 PHP files)

- `ads/_billing.php`
- `ads/click.php`
- `ads/create.php`
- `ads/impression.php`
- `ads/list.php`
- `ads/my.php`
- `ads/stats.php`
- `ads/update.php`

### affiliates (1 PHP files)

- `affiliates/index.php`

### app (5 PHP files)

- `app/_core.php`
- `app/admin/_guard.php`
- `app/admin/branding_save.php`
- `app/branding.php`
- `app/status.php`

### articles (11 PHP files)

- `articles/add_comment.php`
- `articles/by_author.php`
- `articles/categories.php`
- `articles/categries.php`
- `articles/get_comments.php`
- `articles/like.php`
- `articles/list.php`
- `articles/most_read_week.php`
- `articles/recommended.php`
- `articles/trending.php`
- `articles/view.php`

### auth (20 PHP files)

- `auth/change_password.php`
- `auth/forgot.php`
- `auth/getting_started_finish.php`
- `auth/getting_started_update.php`
- `auth/login.php`
- `auth/logout.php`
- `auth/ping.php`
- `auth/profile_field.php`
- `auth/refresh.php`
- `auth/register.php`
- `auth/register_new.php`
- `auth/request_reset.php`
- `auth/resend.php`
- `auth/reset.php`
- `auth/reset_password.php`
- `auth/test_jwt.php`
- `auth/verify.php`
- `auth/verify_email.php`
- `auth/verify_reset_code.php`
- `auth/webview-login.php`

### balance (1 PHP files)

- `balance/balance.php`

### business (14 PHP files)

- `business/_auth.php`
- `business/categories.php`
- `business/create.php`
- `business/create_business.php`
- `business/create_page.php`
- `business/follow.php`
- `business/list.php`
- `business/pages_feed.php`
- `business/search.php`
- `business/toggle_follow.php`
- `business/toggle_like.php`
- `business/unfollow.php`
- `business/update.php`
- `business/view.php`

### comments (3 PHP files)

- `comments/create.php`
- `comments/delete.php`
- `comments/index.php`

### communities (18 PHP files)

- `communities/_auth.php`
- `communities/activity_summary.php`
- `communities/categories.php`
- `communities/create.php`
- `communities/create_community.php`
- `communities/create_group_post.php`
- `communities/group_feed.php`
- `communities/group_media.php`
- `communities/join.php`
- `communities/leave.php`
- `communities/list.php`
- `communities/members.php`
- `communities/recommended.php`
- `communities/search.php`
- `communities/top_contributors.php`
- `communities/top_today.php`
- `communities/trending.php`
- `communities/view.php`

### content_engine (9 PHP files)

- `content_engine/_core.php`
- `content_engine/admin/_guard.php`
- `content_engine/admin/api_keys.php`
- `content_engine/admin/logs.php`
- `content_engine/admin/personas.php`
- `content_engine/admin/queue.php`
- `content_engine/admin/settings.php`
- `content_engine/admin/sources.php`
- `content_engine/admin/user_search.php`

### core (3 PHP files)

- `core/auth.php`
- `core/init.php`
- `core/response.php`

### events (8 PHP files)

- `events/_core.php`
- `events/categories.php`
- `events/create.php`
- `events/detail.php`
- `events/event_feed.php`
- `events/list.php`
- `events/my.php`
- `events/rsvp.php`

### exchange (36 PHP files)

- `exchange/_admin_guard.php`
- `exchange/_auth.php`
- `exchange/_bootstrap.php`
- `exchange/_core.php`
- `exchange/admin/bank_add.php`
- `exchange/admin/bank_toggle.php`
- `exchange/admin/banks_manage_list.php`
- `exchange/admin/order_action.php`
- `exchange/admin/order_detail.php`
- `exchange/admin/orders_list.php`
- `exchange/admin/rates_list.php`
- `exchange/admin/rates_set.php`
- `exchange/admin/rates_toggle.php`
- `exchange/admin/settings_get.php`
- `exchange/admin/settings_save.php`
- `exchange/admin/stats.php`
- `exchange/bank_list.php`
- `exchange/bank_toggle.php`
- `exchange/banks_list.php`
- `exchange/banks_save.php`
- `exchange/beneficiaries_list.php`
- `exchange/beneficiary_create.php`
- `exchange/beneficiary_delete.php`
- `exchange/helpers_exchange.php`
- `exchange/order_action.php`
- `exchange/order_cancel.php`
- `exchange/order_create.php`
- `exchange/order_detail.php`
- `exchange/order_mark_paid.php`
- `exchange/orders_admin.php`
- `exchange/orders_my.php`
- `exchange/quote.php`
- `exchange/rates_get.php`
- `exchange/rates_updates.php`
- `exchange/webhooks/flutterwave.php`
- `exchange/webhooks/monnify.php`

### explore (21 PHP files)

- `explore/_core.php`
- `explore/admin/_guard.php`
- `explore/admin/cities_list.php`
- `explore/admin/city_delete.php`
- `explore/admin/city_save.php`
- `explore/admin/city_toggle.php`
- `explore/admin/place_delete.php`
- `explore/admin/place_save.php`
- `explore/admin/places_list.php`
- `explore/admin/service_delete.php`
- `explore/admin/service_save.php`
- `explore/admin/services_list.php`
- `explore/admin/stats.php`
- `explore/admin/upload.php`
- `explore/admin/users_search.php`
- `explore/cities.php`
- `explore/city_home.php`
- `explore/home.php`
- `explore/index.php`
- `explore/places.php`
- `explore/services.php`

### feed (40 PHP files)

- `feed/_comment_notifications.php`
- `feed/add_comment.php`
- `feed/add_comment_reply.php`
- `feed/add_view.php`
- `feed/by_hashtag.php`
- `feed/comment_like.php`
- `feed/comments.php`
- `feed/delete.php`
- `feed/delete_comment.php`
- `feed/delete_comment_reply.php`
- `feed/discovery.php`
- `feed/edit.php`
- `feed/get_comment_replies.php`
- `feed/get_comments.php`
- `feed/get_likes.php`
- `feed/like.php`
- `feed/like_comment.php`
- `feed/liked.php`
- `feed/list.php`
- `feed/list2.php`
- `feed/my_target.php`
- `feed/nearby.php`
- `feed/react.php`
- `feed/reactions.php`
- `feed/recommend.php`
- `feed/reply_comment_reply.php`
- `feed/report.php`
- `feed/report_cats.php`
- `feed/repost.php`
- `feed/save.php`
- `feed/saved.php`
- `feed/share.php`
- `feed/toggle_comment_reply_like.php`
- `feed/toggle_hide.php`
- `feed/toggle_like.php`
- `feed/toggle_pin.php`
- `feed/toggle_save.php`
- `feed/trending.php`
- `feed/view.php`
- `feed/vote_poll.php`

### hafriktv (2 PHP files)

- `hafriktv/categories.php`
- `hafriktv/index.php`

### hafrikx (59 PHP files)

- `hafrikx/_core.php`
- `hafrikx/academy/apply.php`
- `hafrikx/academy/course-detail.php`
- `hafrikx/academy/courses.php`
- `hafrikx/academy/progress.php`
- `hafrikx/admin/_guard.php`
- `hafrikx/admin/academy-application-detail.php`
- `hafrikx/admin/academy-applications.php`
- `hafrikx/admin/categories.php`
- `hafrikx/admin/courses.php`
- `hafrikx/admin/exchange-accounts.php`
- `hafrikx/admin/exchange-order-action.php`
- `hafrikx/admin/exchange-order-detail.php`
- `hafrikx/admin/exchange-orders.php`
- `hafrikx/admin/order-action.php`
- `hafrikx/admin/order-detail.php`
- `hafrikx/admin/orders.php`
- `hafrikx/admin/reviews.php`
- `hafrikx/admin/settings_save.php`
- `hafrikx/admin/shipments.php`
- `hafrikx/admin/sourcing-action.php`
- `hafrikx/admin/sourcing-detail.php`
- `hafrikx/admin/sourcing-requests.php`
- `hafrikx/admin/stats.php`
- `hafrikx/admin/suppliers.php`
- `hafrikx/admin/upload.php`
- `hafrikx/admin/warehouses.php`
- `hafrikx/exchange/convert.php`
- `hafrikx/exchange/create-order.php`
- `hafrikx/exchange/get-account.php`
- `hafrikx/exchange/history.php`
- `hafrikx/exchange/order-details.php`
- `hafrikx/exchange/public-rates.php`
- `hafrikx/exchange/rate.php`
- `hafrikx/exchange/upload-qr.php`
- `hafrikx/exchange/upload-receipt.php`
- `hafrikx/home.php`
- `hafrikx/marketplace/_provider.php`
- `hafrikx/marketplace/checkout_preview.php`
- `hafrikx/marketplace/elim_provider.php`
- `hafrikx/marketplace/order.php`
- `hafrikx/marketplace/product.php`
- `hafrikx/marketplace/search.php`
- `hafrikx/marketplace/service.php`
- `hafrikx/orders/create.php`
- `hafrikx/orders/detail.php`
- `hafrikx/orders.php`
- `hafrikx/public-track.php`
- `hafrikx/shipments/track.php`
- `hafrikx/shipments.php`
- `hafrikx/sourcing/request-detail.php`
- `hafrikx/sourcing/request.php`
- `hafrikx/sourcing/requests.php`
- `hafrikx/supplier-categories.php`
- `hafrikx/supplier-detail.php`
- `hafrikx/supplier-review.php`
- `hafrikx/suppliers.php`
- `hafrikx/tracking.php`
- `hafrikx/warehouses.php`

### hashtags (8 PHP files)

- `hashtags/add_to_post.php`
- `hashtags/info.php`
- `hashtags/posts.php`
- `hashtags/reels.php`
- `hashtags/search.php`
- `hashtags/suggest.php`
- `hashtags/top_users.php`
- `hashtags/trending.php`

### home (3 PHP files)

- `home/banners.php`
- `home/newbanner.php`
- `home/quick_links.php`

### home_layout (3 PHP files)

- `home_layout/_registry.php`
- `home_layout/admin.php`
- `home_layout/get.php`

### hot_topics (3 PHP files)

- `hot_topics/_core.php`
- `hot_topics/admin.php`
- `hot_topics/get.php`

### inbox (3 PHP files)

- `inbox/inbox.php`
- `inbox/send.php`
- `inbox/thread.php`

### jobs (6 PHP files)

- `jobs/_core.php`
- `jobs/applications.php`
- `jobs/apply.php`
- `jobs/categories.php`
- `jobs/detail.php`
- `jobs/list.php`

### live (8 PHP files)

- `live/_core.php`
- `live/end.php`
- `live/join.php`
- `live/leave.php`
- `live/list.php`
- `live/pay.php`
- `live/start.php`
- `live/stats.php`

### location (2 PHP files)

- `location/countries.php`
- `location/profile_field.php`

### marketplace (58 PHP files)

- `marketplace/_collection.php`
- `marketplace/_wallet_payments.php`
- `marketplace/add_to_cart.php`
- `marketplace/addresses.php`
- `marketplace/app/ENDPOINT_TEMPLATE.php`
- `marketplace/app/get_order_detail.php`
- `marketplace/app/get_orders.php`
- `marketplace/app/jwt_auth.php`
- `marketplace/app/save_wc_order.php`
- `marketplace/app/seller_orders.php`
- `marketplace/app/seller_update_order.php`
- `marketplace/app/topup_init.php`
- `marketplace/app/wallet_checkout.php`
- `marketplace/banners.php`
- `marketplace/checkout.php`
- `marketplace/checkout_preview.php`
- `marketplace/confirm_received.php`
- `marketplace/dispute_add_evidence.php`
- `marketplace/dispute_create.php`
- `marketplace/get_cart.php`
- `marketplace/get_categories.php`
- `marketplace/get_countries.php`
- `marketplace/get_disputes.php`
- `marketplace/get_housing.php`
- `marketplace/get_housing_detail.php`
- `marketplace/get_market_order.php`
- `marketplace/get_market_orders.php`
- `marketplace/get_marketplace.php`
- `marketplace/get_my_products.php`
- `marketplace/get_offers.php`
- `marketplace/get_order_details.php`
- `marketplace/get_orders.php`
- `marketplace/get_product.php`
- `marketplace/get_product_reviews.php`
- `marketplace/get_rental.php`
- `marketplace/get_rentals.php`
- `marketplace/get_service.php`
- `marketplace/get_services.php`
- `marketplace/get_verification_status.php`
- `marketplace/market_order_action.php`
- `marketplace/market_order_detail.php`
- `marketplace/market_orders.php`
- `marketplace/offer_action.php`
- `marketplace/offer_create.php`
- `marketplace/pay_order.php`
- `marketplace/remove_from_cart.php`
- `marketplace/rental_availability.php`
- `marketplace/rental_request.php`
- `marketplace/review_product.php`
- `marketplace/seller_orders.php`
- `marketplace/seller_update_order.php`
- `marketplace/service_request.php`
- `marketplace/topup_callback.php`
- `marketplace/topup_init.php`
- `marketplace/trendy.php`
- `marketplace/update_cart.php`
- `marketplace/verification_submit.php`
- `marketplace/wallet_checkout.php`

### menu (3 PHP files)

- `menu/_registry.php`
- `menu/admin.php`
- `menu/get.php`

### messages (19 PHP files)

- `messages/_common.php`
- `messages/contacts.php`
- `messages/conversations.php`
- `messages/delete-conversation.php`
- `messages/delete-message.php`
- `messages/get.php`
- `messages/inbox.php`
- `messages/mark-seen.php`
- `messages/mark_seen.php`
- `messages/messages.php`
- `messages/open.php`
- `messages/react.php`
- `messages/send-image.php`
- `messages/send-voice.php`
- `messages/send.php`
- `messages/start.php`
- `messages/thread.php`
- `messages/typing.php`
- `messages/unread-count.php`

### middleware (1 PHP files)

- `middleware/auth.php`

### nearby (1 PHP files)

- `nearby/update_location.php`

### notifications (23 PHP files)

- `notifications/_admin_guard.php`
- `notifications/_admin_notify.php`
- `notifications/_common.php`
- `notifications/_follow_notify.php`
- `notifications/_push.php`
- `notifications/_retention.php`
- `notifications/admin/history.php`
- `notifications/admin/send.php`
- `notifications/admin/stats.php`
- `notifications/admin/users_search.php`
- `notifications/badge.php`
- `notifications/badges.php`
- `notifications/broadcasts.php`
- `notifications/count.php`
- `notifications/counter.php`
- `notifications/get.php`
- `notifications/list.php`
- `notifications/mark_read.php`
- `notifications/read.php`
- `notifications/register_push.php`
- `notifications/send.php`
- `notifications/system.php`
- `notifications/unread_count.php`

### onboarding (2 PHP files)

- `onboarding/complete.php`
- `onboarding/follow.php`

### payment (2 PHP files)

- `payment/create.php`
- `payment/submit-payment.php`

### people (4 PHP files)

- `people/featured_user.php`
- `people/follow_toggle.php`
- `people/list.php`
- `people/nearby_people.php`

### points (5 PHP files)

- `points/balance.php`
- `points/leaderboard.php`
- `points/rank_me.php`
- `points/remaining.php`
- `points/transactions.php`

### posts (4 PHP files)

- `posts/create.php`
- `posts/create_post.php`
- `posts/feed.php`
- `posts/list.php`

### profile (2 PHP files)

- `profile/avatar.php`
- `profile/city.php`

### reels (12 PHP files)

- `reels/comment_add.php`
- `reels/comments_list.php`
- `reels/follow.php`
- `reels/get_likes.php`
- `reels/list.php`
- `reels/notify_helper.php`
- `reels/share.php`
- `reels/toggle_like.php`
- `reels/toggle_save.php`
- `reels/upload.php`
- `reels/view.php`
- `reels/watch_time.php`

### search (12 PHP files)

- `search/ai-search.php`
- `search/autocomplete.php`
- `search/by_hashtag.php`
- `search/core-search.php`
- `search/embedding.php`
- `search/index.php`
- `search/index2.php`
- `search/log.php`
- `search/models.php`
- `search/suggestions.php`
- `search/test.php`
- `search/trending.php`

### services (20 PHP files)

- `services/_admin_guard.php`
- `services/_auth.php`
- `services/_core.php`
- `services/admin/application_action.php`
- `services/admin/application_detail.php`
- `services/admin/applications_list.php`
- `services/admin/field_save.php`
- `services/admin/field_toggle.php`
- `services/admin/fields_list.php`
- `services/admin/service_save.php`
- `services/admin/service_toggle.php`
- `services/admin/services_list.php`
- `services/admin/settings_get.php`
- `services/admin/settings_save.php`
- `services/admin/stats.php`
- `services/apply.php`
- `services/detail.php`
- `services/get_application.php`
- `services/list.php`
- `services/my_applications.php`

### stories (6 PHP files)

- `stories/_core.php`
- `stories/create.php`
- `stories/delete.php`
- `stories/list.php`
- `stories/storyapi.php`
- `stories/view.php`

### system (1 PHP files)

- `system/announcements.php`

### telegram (2 PHP files)

- `telegram/_core.php`
- `telegram/webhook.php`

### universities (32 PHP files)

- `universities/_admin_guard.php`
- `universities/_auth.php`
- `universities/_core.php`
- `universities/_documents.php`
- `universities/_fees.php`
- `universities/_validation.php`
- `universities/admin/application_action.php`
- `universities/admin/application_detail.php`
- `universities/admin/applications_list.php`
- `universities/admin/catalog_export.php`
- `universities/admin/field_save.php`
- `universities/admin/field_toggle.php`
- `universities/admin/fields_list.php`
- `universities/admin/program_bulk.php`
- `universities/admin/program_save.php`
- `universities/admin/program_toggle.php`
- `universities/admin/programs_list.php`
- `universities/admin/settings_get.php`
- `universities/admin/settings_save.php`
- `universities/admin/stats.php`
- `universities/admin/universities_list.php`
- `universities/admin/university_save.php`
- `universities/admin/university_toggle.php`
- `universities/apply.php`
- `universities/detail.php`
- `universities/download_document.php`
- `universities/get_application.php`
- `universities/list.php`
- `universities/my_applications.php`
- `universities/program_detail.php`
- `universities/programs.php`
- `universities/upload_document.php`

### uploads (5 PHP files)

- `uploads/hafrik_media.php`
- `uploads/hafrik_transcode_runner.php`
- `uploads/hafrik_transcode_status.php`
- `uploads/transcode.php`
- `uploads/transcode_lib.php`

### users (38 PHP files)

- `users/_profile_core.php`
- `users/block.php`
- `users/blocked-list.php`
- `users/create_post.php`
- `users/delete_account.php`
- `users/delete_avatar.php`
- `users/delete_cover.php`
- `users/follow.php`
- `users/me.php`
- `users/post.php`
- `users/profile.php`
- `users/profile_albums.php`
- `users/profile_completion.php`
- `users/profile_events.php`
- `users/profile_feed.php`
- `users/profile_followers.php`
- `users/profile_following.php`
- `users/profile_groups.php`
- `users/profile_pages.php`
- `users/profile_products.php`
- `users/profile_subscriptions.php`
- `users/test_debug.php`
- `users/unblock.php`
- `users/update_account.php`
- `users/update_avatar.php`
- `users/update_bio.php`
- `users/update_cover.php`
- `users/update_notifications.php`
- `users/update_password.php`
- `users/update_privacy.php`
- `users/update_profile.php`
- `users/user_communities.php`
- `users/user_feed.php`
- `users/user_followers.php`
- `users/user_following.php`
- `users/user_media.php`
- `users/user_pages.php`
- `users/view.php`

### verification (4 PHP files)

- `verification/list.php`
- `verification/review.php`
- `verification/status.php`
- `verification/submit.php`

### wallet (8 PHP files)

- `wallet/_auth.php`
- `wallet/balance.php`
- `wallet/payments.php`
- `wallet/tip.php`
- `wallet/transactions.php`
- `wallet/transfer.php`
- `wallet/withdraw_affiliates.php`
- `wallet/withdraw_points.php`

### Root PHP entry points and helpers

- `_auth_required.php`
- `_image.php`
- `_sngine.php`
- `_wasabi.php`
- `config.php`
- `db.php`
- `debug_helpers.php`
- `helpers.php`
- `helpers_mail.php`
- `jwt.php`
- `mail_config.php`
- `mobile-sync-login.php`
- `schema_map.php`
- `test.php`
- `test_auth.php`
- `testmail.php`
