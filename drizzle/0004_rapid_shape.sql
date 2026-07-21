CREATE TABLE `salary_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`effective_year` integer NOT NULL,
	`salary` real NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `salary_changes_person_id_idx` ON `salary_changes` (`person_id`);--> statement-breakpoint
ALTER TABLE `people` ADD `retirement_age` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `salary_growth_pct` real;