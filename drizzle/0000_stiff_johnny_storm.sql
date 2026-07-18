CREATE TABLE `account_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`recorded_at` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`start_balance` real NOT NULL,
	`money_in` real,
	`transfer_out` real,
	`end_balance` real NOT NULL,
	`is_estimated` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_snapshots_account_id_idx` ON `account_snapshots` (`account_id`);--> statement-breakpoint
CREATE INDEX `account_snapshots_account_period_idx` ON `account_snapshots` (`account_id`,`year`,`month`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`person_id` text,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`account_type` text NOT NULL,
	`pot_category` text NOT NULL,
	`is_ring_fenced` integer DEFAULT false NOT NULL,
	`is_goal_earmarked` integer DEFAULT false NOT NULL,
	`monthly_contribution` real DEFAULT 0 NOT NULL,
	`current_balance` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "accounts_owner_check" CHECK("accounts"."owner" in ('person_a','person_b','joint')),
	CONSTRAINT "accounts_account_type_check" CHECK("accounts"."account_type" in ('cash_isa','stocks_isa','pension','lisa','savings_account','other')),
	CONSTRAINT "accounts_pot_category_check" CHECK("accounts"."pot_category" in ('pension','investments','cash')),
	CONSTRAINT "accounts_owner_person_id_check" CHECK(("accounts"."owner" = 'joint' AND "accounts"."person_id" IS NULL) OR ("accounts"."owner" != 'joint' AND "accounts"."person_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `accounts_household_id_idx` ON `accounts` (`household_id`);--> statement-breakpoint
CREATE INDEX `accounts_person_id_idx` ON `accounts` (`person_id`);--> statement-breakpoint
CREATE TABLE `forecast_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_at` text NOT NULL,
	`type` text NOT NULL,
	`household_state_json` text NOT NULL,
	`note` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "forecast_snapshots_type_check" CHECK("forecast_snapshots"."type" in ('baseline','replan'))
);
--> statement-breakpoint
CREATE INDEX `forecast_snapshots_household_id_idx` ON `forecast_snapshots` (`household_id`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`retirement_age` integer DEFAULT 58 NOT NULL,
	`target_income_today` real,
	`real_return` real DEFAULT 0.07 NOT NULL,
	`cash_return` real DEFAULT 0.045 NOT NULL,
	`swr` real DEFAULT 0.04 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`salary` real,
	`bonus` real,
	`employer_pension_user_pct` real,
	`employer_pension_match_pct` real,
	`employer_pension_additional_pct` real,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `people_household_id_idx` ON `people` (`household_id`);