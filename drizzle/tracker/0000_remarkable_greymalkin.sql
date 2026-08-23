CREATE TABLE `admin_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `alert_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscriber_id` integer NOT NULL,
	`portfolio_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_subscriptions_subscriber_portfolio_unique` ON `alert_subscriptions` (`subscriber_id`,`portfolio_id`);--> statement-breakpoint
CREATE TABLE `benchmark_readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`benchmark_id` integer NOT NULL,
	`on_date` text NOT NULL,
	`level_micro` integer NOT NULL,
	FOREIGN KEY (`benchmark_id`) REFERENCES `benchmarks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `benchmark_readings_benchmark_date_idx` ON `benchmark_readings` (`benchmark_id`,`on_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_readings_benchmark_date_unique` ON `benchmark_readings` (`benchmark_id`,`on_date`);--> statement-breakpoint
CREATE TABLE `benchmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmarks_code_unique` ON `benchmarks` (`code`);--> statement-breakpoint
CREATE TABLE `fee_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`charged_on` text NOT NULL,
	`amount_pence` integer NOT NULL,
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fee_events_portfolio_id_idx` ON `fee_events` (`portfolio_id`);--> statement-breakpoint
CREATE TABLE `flows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`effective_date` text NOT NULL,
	`amount_pence` integer NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "flows_kind_check" CHECK("flows"."kind" in ('initial','contribution','withdrawal'))
);
--> statement-breakpoint
CREATE INDEX `flows_portfolio_id_idx` ON `flows` (`portfolio_id`);--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`as_of_date` text NOT NULL,
	`isin` text,
	`instrument_name` text NOT NULL,
	`asset_class` text NOT NULL,
	`region` text,
	`weight_bps` integer NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "holdings_asset_class_check" CHECK("holdings"."asset_class" in ('equity','bond','cash','property','alternative'))
);
--> statement-breakpoint
CREATE INDEX `holdings_portfolio_date_idx` ON `holdings` (`portfolio_id`,`as_of_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `holdings_portfolio_date_instrument_unique` ON `holdings` (`portfolio_id`,`as_of_date`,`instrument_name`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer,
	`published_at` text NOT NULL,
	`title` text NOT NULL,
	`body_md` text NOT NULL,
	`slug` text NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notes_slug_unique` ON `notes` (`slug`);--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`provider_risk_label` text,
	`style_family` text,
	`wrapper` text,
	`inception_date` text NOT NULL,
	`account_open_date` text,
	`initial_pence` integer NOT NULL,
	`platform_fee_bps` integer,
	`fee_tiers_json` text,
	`ocf_bps` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "portfolios_style_family_check" CHECK("portfolios"."style_family" is null or "portfolios"."style_family" in ('mainstream','sri','thematic','fixed_allocation')),
	CONSTRAINT "portfolios_wrapper_check" CHECK("portfolios"."wrapper" is null or "portfolios"."wrapper" in ('isa','gia','sipp'))
);
--> statement-breakpoint
CREATE INDEX `portfolios_provider_id_idx` ON `portfolios` (`provider_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `portfolios_provider_slug_unique` ON `portfolios` (`provider_id`,`slug`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `providers_slug_unique` ON `providers` (`slug`);--> statement-breakpoint
CREATE TABLE `readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`valuation_date` text NOT NULL,
	`read_at` text NOT NULL,
	`value_pence` integer NOT NULL,
	`units_reported` integer,
	`cash_pence` integer,
	`source` text NOT NULL,
	`evidence_key` text,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "readings_source_check" CHECK("readings"."source" in ('web','app','statement'))
);
--> statement-breakpoint
CREATE INDEX `readings_portfolio_valuation_idx` ON `readings` (`portfolio_id`,`valuation_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `readings_portfolio_valuation_unique` ON `readings` (`portfolio_id`,`valuation_date`);--> statement-breakpoint
CREATE TABLE `series_cache` (
	`portfolio_id` integer NOT NULL,
	`on_date` text NOT NULL,
	`unit_price_micro` integer NOT NULL,
	`units_micro` integer NOT NULL,
	`value_pence` integer NOT NULL,
	`is_forward_filled` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`portfolio_id`, `on_date`),
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `series_cache_portfolio_date_idx` ON `series_cache` (`portfolio_id`,`on_date`);--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`confirmed_at` text,
	`unsub_token` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email_unique` ON `subscribers` (`email`);