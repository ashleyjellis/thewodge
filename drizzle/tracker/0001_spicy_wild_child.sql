CREATE TABLE `portfolio_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`event_date` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body_md` text,
	`source_url` text,
	`is_generated` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "portfolio_events_kind_check" CHECK("portfolio_events"."kind" in ('rebalance','fees','holdings','commentary'))
);
--> statement-breakpoint
CREATE INDEX `portfolio_events_portfolio_date_idx` ON `portfolio_events` (`portfolio_id`,`event_date`);