CREATE INDEX `friends_requester_status` ON `friendships` (`requested_by`,`status`);--> statement-breakpoint
CREATE INDEX `messages_retention_time` ON `chat_messages` (`created_at`);