DROP INDEX "account_snapshots_account_id_idx";--> statement-breakpoint
DROP INDEX "account_snapshots_account_period_idx";--> statement-breakpoint
DROP INDEX "accounts_household_id_idx";--> statement-breakpoint
DROP INDEX "accounts_person_id_idx";--> statement-breakpoint
DROP INDEX "forecast_snapshots_household_id_idx";--> statement-breakpoint
DROP INDEX "people_household_id_idx";--> statement-breakpoint
ALTER TABLE `households` ALTER COLUMN "retirement_age" TO "retirement_age" integer NOT NULL DEFAULT 60;--> statement-breakpoint
CREATE INDEX `account_snapshots_account_id_idx` ON `account_snapshots` (`account_id`);--> statement-breakpoint
CREATE INDEX `account_snapshots_account_period_idx` ON `account_snapshots` (`account_id`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `accounts_household_id_idx` ON `accounts` (`household_id`);--> statement-breakpoint
CREATE INDEX `accounts_person_id_idx` ON `accounts` (`person_id`);--> statement-breakpoint
CREATE INDEX `forecast_snapshots_household_id_idx` ON `forecast_snapshots` (`household_id`);--> statement-breakpoint
CREATE INDEX `people_household_id_idx` ON `people` (`household_id`);