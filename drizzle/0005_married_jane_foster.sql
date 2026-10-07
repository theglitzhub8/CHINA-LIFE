CREATE TABLE `club_music_state` (
	`city` text PRIMARY KEY NOT NULL,
	`track` text NOT NULL,
	`request_id` text,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `club_music_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`city` text NOT NULL,
	`user_id` text NOT NULL,
	`track` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `music_city_queue` ON `club_music_requests` (`city`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_user_requests` ON `club_music_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `voice_members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`city` text NOT NULL,
	`place` text NOT NULL,
	`muted` integer NOT NULL,
	`seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `voice_room_time` ON `voice_members` (`city`,`place`,`seen_at`);--> statement-breakpoint
CREATE TABLE `voice_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_id` text NOT NULL,
	`sender_session` text NOT NULL,
	`target_id` text NOT NULL,
	`target_session` text NOT NULL,
	`city` text NOT NULL,
	`place` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `voice_inbox` ON `voice_signals` (`target_id`,`target_session`,`id`);--> statement-breakpoint
CREATE INDEX `voice_signal_expiry` ON `voice_signals` (`created_at`);--> statement-breakpoint
CREATE INDEX `voice_sender_rate` ON `voice_signals` (`sender_id`,`created_at`);