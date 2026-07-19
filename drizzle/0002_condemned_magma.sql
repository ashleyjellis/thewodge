CREATE TABLE `contribution_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner` text NOT NULL,
	`pot_category` text NOT NULL,
	`effective_year` integer NOT NULL,
	`change_type` text NOT NULL,
	`value` real NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "contribution_changes_owner_check" CHECK("contribution_changes"."owner" in ('person_a','person_b','joint')),
	CONSTRAINT "contribution_changes_pot_category_check" CHECK("contribution_changes"."pot_category" in ('pension','investments','cash')),
	CONSTRAINT "contribution_changes_change_type_check" CHECK("contribution_changes"."change_type" in ('set','grow_pct'))
);
--> statement-breakpoint
CREATE INDEX `contribution_changes_household_id_idx` ON `contribution_changes` (`household_id`);--> statement-breakpoint
CREATE TABLE `planned_events` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner` text NOT NULL,
	`pot_category` text NOT NULL,
	`year` integer NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "planned_events_owner_check" CHECK("planned_events"."owner" in ('person_a','person_b','joint')),
	CONSTRAINT "planned_events_pot_category_check" CHECK("planned_events"."pot_category" in ('pension','investments','cash'))
);
--> statement-breakpoint
CREATE INDEX `planned_events_household_id_idx` ON `planned_events` (`household_id`);