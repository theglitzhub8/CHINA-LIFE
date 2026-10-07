CREATE TABLE `city_presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`sim_name` text NOT NULL,
	`place` text NOT NULL,
	`color` text NOT NULL,
	`skin` text NOT NULL,
	`hair` text NOT NULL,
	`x` real NOT NULL,
	`z` real NOT NULL,
	`seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `character_saves` (
	`user_id` text PRIMARY KEY NOT NULL,
	`state_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
