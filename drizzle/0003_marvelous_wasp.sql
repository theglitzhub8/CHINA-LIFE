ALTER TABLE `chat_reports` ADD `message_body` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_reports` ADD `sender_id` text DEFAULT '' NOT NULL;