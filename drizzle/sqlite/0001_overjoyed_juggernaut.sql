PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_outbox` (
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`queued_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`table_name`, `row_id`)
);
--> statement-breakpoint
INSERT INTO `__new_outbox`("table_name", "row_id", "queued_at") SELECT "table_name", "row_id", "queued_at" FROM `outbox`;--> statement-breakpoint
DROP TABLE `outbox`;--> statement-breakpoint
ALTER TABLE `__new_outbox` RENAME TO `outbox`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `household` ADD `invite_code` text;--> statement-breakpoint
ALTER TABLE `household_member` ADD `email` text;--> statement-breakpoint
ALTER TABLE `sync_state` ADD `user_id` text;