PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_contribution_changes` (
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
	CONSTRAINT "contribution_changes_owner_check" CHECK("__new_contribution_changes"."owner" in ('person_a','person_b','joint')),
	CONSTRAINT "contribution_changes_pot_category_check" CHECK("__new_contribution_changes"."pot_category" in ('pension','investments','cash')),
	CONSTRAINT "contribution_changes_change_type_check" CHECK("__new_contribution_changes"."change_type" in ('set','grow_pct','annual_bonus'))
);
--> statement-breakpoint
INSERT INTO `__new_contribution_changes`("id", "household_id", "owner", "pot_category", "effective_year", "change_type", "value", "note", "created_at") SELECT "id", "household_id", "owner", "pot_category", "effective_year", "change_type", "value", "note", "created_at" FROM `contribution_changes`;--> statement-breakpoint
DROP TABLE `contribution_changes`;--> statement-breakpoint
ALTER TABLE `__new_contribution_changes` RENAME TO `contribution_changes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `contribution_changes_household_id_idx` ON `contribution_changes` (`household_id`);