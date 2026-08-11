CREATE TABLE `change_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`detected_at` text NOT NULL,
	`announced_at` text,
	`effective_at` text,
	`headline` text,
	`summary` text,
	`direction` text,
	`charge_ids` text,
	`before_snapshot_id` text,
	`after_snapshot_id` text,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`before_snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "change_events_direction_check" CHECK("change_events"."direction" is null or "change_events"."direction" in ('increase','decrease','mixed','structural','new','withdrawn'))
);
--> statement-breakpoint
CREATE TABLE `charges` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`wrapper` text NOT NULL,
	`asset_type` text NOT NULL,
	`charge_type` text NOT NULL,
	`product_name` text,
	`composite_key` text GENERATED ALWAYS AS (("provider_id" || '|' || "wrapper" || '|' || "asset_type" || '|' || "charge_type" || '|' || coalesce("product_name",''))) STORED,
	`value_type` text NOT NULL,
	`value_numeric` real,
	`value_json` text,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`cap_gbp_annual` real,
	`floor_gbp_annual` real,
	`cap_scope` text,
	`conditions` text,
	`is_promotional` integer DEFAULT false NOT NULL,
	`promo_ends_at` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`observed_at` text NOT NULL,
	`superseded_at` text,
	`snapshot_id` text NOT NULL,
	`source_id` text NOT NULL,
	`source_quote` text,
	`extraction_confidence` real,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	`verified_by` text,
	`verified_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "charges_wrapper_check" CHECK("charges"."wrapper" in ('isa','sipp','gia','lisa','jisa','jsipp','cash_isa','any')),
	CONSTRAINT "charges_asset_type_check" CHECK("charges"."asset_type" in ('funds','listed_securities','both','cash','n/a')),
	CONSTRAINT "charges_charge_type_check" CHECK("charges"."charge_type" in ('platform_percentage','platform_flat','account_fee','dealing_fund','dealing_share','dealing_regular','fx_fee','exit_fee','transfer_out_fee','drawdown_fee','inactivity_fee','ready_made_ocf','ready_made_service','cash_interest_paid','subscription','other')),
	CONSTRAINT "charges_value_type_check" CHECK("charges"."value_type" in ('percentage','fixed_gbp','tiered','free','conditional')),
	CONSTRAINT "charges_verification_status_check" CHECK("charges"."verification_status" in ('pending','approved','disputed','corrected','withdrawn'))
);
--> statement-breakpoint
CREATE INDEX `idx_charges_composite` ON `charges` (`composite_key`,`effective_from`);--> statement-breakpoint
CREATE INDEX `idx_charges_current` ON `charges` (`composite_key`) WHERE "charges"."effective_to" is null and "charges"."verification_status" = 'approved';--> statement-breakpoint
CREATE INDEX `idx_charges_provider` ON `charges` (`provider_id`,`wrapper`,`effective_from`);--> statement-breakpoint
CREATE INDEX `idx_charges_pending` ON `charges` (`created_at`) WHERE "charges"."verification_status" = 'pending';--> statement-breakpoint
CREATE TABLE `corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`charge_id` text,
	`provider_id` text,
	`reported_by` text,
	`reported_at` text NOT NULL,
	`description` text NOT NULL,
	`resolution` text,
	`resolved_at` text,
	`is_public` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`charge_id`) REFERENCES `charges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`legal_entity` text,
	`fca_frn` text,
	`provider_type` text NOT NULL,
	`website` text,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	CONSTRAINT "providers_provider_type_check" CHECK("providers"."provider_type" in ('platform','bank','asset_manager','robo','life_company','neo_broker'))
);
--> statement-breakpoint
CREATE TABLE `review_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`source_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`extraction_a` text,
	`extraction_b` text,
	`agreement_score` real,
	`diff_summary` text,
	`prompt_version` text,
	`reviewer_notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "review_queue_status_check" CHECK("review_queue"."status" in ('pending','approved','rejected','needs_info'))
);
--> statement-breakpoint
CREATE INDEX `idx_queue_pending` ON `review_queue` (`created_at`) WHERE "review_queue"."status" = 'pending';--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`observed_at` text NOT NULL,
	`http_status` integer,
	`content_sha256` text NOT NULL,
	`raw_sha256` text NOT NULL,
	`storage_key` text NOT NULL,
	`byte_size` integer,
	`content_type` text,
	`is_change` integer DEFAULT false NOT NULL,
	`fetch_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_source_time` ON `snapshots` (`source_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_hash` ON `snapshots` (`source_id`,`content_sha256`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_changes` ON `snapshots` (`observed_at`) WHERE "snapshots"."is_change" = 1;--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`url` text NOT NULL,
	`source_type` text NOT NULL,
	`label` text NOT NULL,
	`is_authoritative` integer DEFAULT false NOT NULL,
	`fetch_method` text DEFAULT 'http' NOT NULL,
	`content_selector` text,
	`check_frequency` text DEFAULT 'weekly' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_checked_at` text,
	`last_changed_at` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sources_source_type_check" CHECK("sources"."source_type" in ('html','pdf')),
	CONSTRAINT "sources_fetch_method_check" CHECK("sources"."fetch_method" in ('http','playwright')),
	CONSTRAINT "sources_check_frequency_check" CHECK("sources"."check_frequency" in ('daily','weekly','monthly'))
);
--> statement-breakpoint
CREATE INDEX `idx_sources_active_freq` ON `sources` (`check_frequency`,`last_checked_at`) WHERE "sources"."is_active" = 1;