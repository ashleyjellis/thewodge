PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_forecast_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_at` text NOT NULL,
	`type` text NOT NULL,
	`household_state_json` text NOT NULL,
	`note` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "forecast_snapshots_type_check" CHECK("__new_forecast_snapshots"."type" in ('baseline','replan','checkpoint'))
);
--> statement-breakpoint
INSERT INTO `__new_forecast_snapshots`("id", "household_id", "created_at", "type", "household_state_json", "note") SELECT "id", "household_id", "created_at", "type", "household_state_json", "note" FROM `forecast_snapshots`;--> statement-breakpoint
DROP TABLE `forecast_snapshots`;--> statement-breakpoint
ALTER TABLE `__new_forecast_snapshots` RENAME TO `forecast_snapshots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `forecast_snapshots_household_id_idx` ON `forecast_snapshots` (`household_id`);