CREATE TABLE `player_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`peer_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blocks_owner_peer` ON `player_blocks` (`owner_id`,`peer_id`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`pair_key` text PRIMARY KEY NOT NULL,
	`first_id` text NOT NULL,
	`second_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `friends_first` ON `friendships` (`first_id`);--> statement-breakpoint
CREATE INDEX `friends_second` ON `friendships` (`second_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`channel` text NOT NULL,
	`room` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_room_time` ON `chat_messages` (`channel`,`room`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_sender_time` ON `chat_messages` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `player_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`sim_name` text NOT NULL,
	`color` text NOT NULL,
	`skin` text NOT NULL,
	`hair` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_profiles_public_id_unique` ON `player_profiles` (`public_id`);--> statement-breakpoint
CREATE TABLE `chat_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`message_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
DROP INDEX `presence_venue_seen`;--> statement-breakpoint
ALTER TABLE `city_presence` ADD `city` text DEFAULT 'Shenyang' NOT NULL;--> statement-breakpoint
CREATE INDEX `presence_venue_seen` ON `city_presence` (`city`,`place`,`seen_at`);