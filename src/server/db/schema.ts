/**
 * Database schema — the logged-in experience (Turso/libSQL via Drizzle).
 *
 * Five tables, exactly as specified: households, people, accounts,
 * account_snapshots, forecast_snapshots. Server-only — never imported by client
 * code. This is ring 2 (storage); the calc engine (a later phase) stays pure and
 * unit-testable independent of this file.
 *
 * Nullability follows the source spec's SQL sketch literally: a column is NOT
 * NULL here only where the spec explicitly wrote "not null" or gave it a DEFAULT
 * (which always yields a value). Everything else is left nullable, matching the
 * spec's own restraint rather than over-constraining beyond it.
 *
 * `pot_category` on accounts is DERIVED from `account_type` by a fixed mapping
 * (see accountTypeToPotCategory in accounts.ts) — it is written by the data-access
 * layer, never accepted as a raw caller input, so the two can never drift apart.
 *
 * `account_snapshots` is append-only: this module exposes no update/delete for it
 * (see accountSnapshots.ts) — only insert and read.
 */
import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// ── households ────────────────────────────────────────────────────────────
// One household per signed-in user for v1 (single household owner) — there is
// deliberately no user/auth linkage column yet; auth is out of scope for this
// build (see the source spec's "General reminders"). For v1, "the household" is
// simply the one row that exists — see getHousehold() in households.ts.

export const households = sqliteTable('households', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  retirementAge: integer('retirement_age').notNull().default(60),
  /** annual, today's money — nullable until the household sets a target */
  targetIncomeToday: real('target_income_today'),
  realReturn: real('real_return').notNull().default(0.07),
  cashReturn: real('cash_return').notNull().default(0.045),
  swr: real('swr').notNull().default(0.04),
  /** /app2: how many down-years to stress-test the plan against (planBand.ts) —
   *  0 (default) collapses the low/high band to exactly the mid projection,
   *  a feature that's off until explicitly opted into, not hidden */
  downYearsCount: integer('down_years_count').notNull().default(0),
  /** /app2: age someone plans to stop paid work — nullable until set; pairs
   *  with targetIncomeToday/swr for the bridge-to-pension-access adequacy
   *  check (bridgeCheck.ts). Household-level rather than per-person: it
   *  pairs with two already-household-level fields, and per-person framing
   *  raises an ambiguity (whose stop-work age, for a household?) this
   *  feature doesn't resolve. */
  stopWorkAge: integer('stop_work_age'),
})

// ── people ────────────────────────────────────────────────────────────────
// Up to two people per household (enforced at the data-access layer, not the DB —
// see people.ts).

export const people = sqliteTable(
  'people',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    name: text('name').notNull(),
    age: integer('age').notNull(),
    /** this person's own planned retirement age — replaces the old
     *  household-wide retirementAge as the driver of their forecast
     *  horizon; a joint/total view runs to the later of the two people's
     *  own ages (see resolveOwnerAge in scheduledPlan.ts) */
    retirementAge: integer('retirement_age').notNull().default(60),
    salary: real('salary'),
    /** fractional annual growth assumed for salary (0.02 = 2%) — the
     *  baseline projection; actuals logged in salary_changes supersede it
     *  for the year they land and rebase everything after (see
     *  resolveSalarySchedule in salary.ts) */
    salaryGrowthPct: real('salary_growth_pct'),
    bonus: real('bonus'),
    employerPensionUserPct: real('employer_pension_user_pct'),
    employerPensionMatchPct: real('employer_pension_match_pct'),
    employerPensionAdditionalPct: real('employer_pension_additional_pct'),
  },
  (t) => [index('people_household_id_idx').on(t.householdId)],
)

// ── salary_changes ────────────────────────────────────────────────────────
// An actual salary confirmed for a given year — logged over time, the same
// actuals-vs-assumption relationship account_snapshots has with a flat
// growth rate. Append-only, same reasoning as account_snapshots: this is a
// historical record of what a salary actually was, not a live editable
// assumption (see salary.ts).

export const salaryChanges = sqliteTable(
  'salary_changes',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => people.id),
    effectiveYear: integer('effective_year').notNull(),
    salary: real('salary').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('salary_changes_person_id_idx').on(t.personId)],
)

// ── accounts ──────────────────────────────────────────────────────────────
// Real accounts/products, each tagged to exactly one pot category. Field names
// deliberately echo the "Payd" reference implementation (owner/provider/
// account_type/current_balance) for consistency with prior work.

export const ACCOUNT_OWNERS = ['person_a', 'person_b', 'joint'] as const
export type AccountOwner = (typeof ACCOUNT_OWNERS)[number]

export const ACCOUNT_TYPES = [
  'cash_isa',
  'stocks_isa',
  'pension',
  'lisa',
  'savings_account',
  'other',
] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const POT_CATEGORIES = ['pension', 'investments', 'cash'] as const
export type PotCategory = (typeof POT_CATEGORIES)[number]

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    /** null for joint accounts — they roll up into the household, not a person */
    personId: text('person_id').references(() => people.id),
    owner: text('owner').notNull().$type<AccountOwner>(),
    provider: text('provider').notNull(),
    accountType: text('account_type').notNull().$type<AccountType>(),
    /** derived from accountType — see accountTypeToPotCategory(); never a raw input */
    potCategory: text('pot_category').notNull().$type<PotCategory>(),
    /** cash only: true = emergency fund. Always counted in totals and growth —
     *  never excluded from anything. Only ever a display label (e.g. a future
     *  "available to invest" view would call it out separately). */
    isRingFenced: integer('is_ring_fenced', { mode: 'boolean' }).notNull().default(false),
    /** cash only: e.g. house deposit */
    isGoalEarmarked: integer('is_goal_earmarked', { mode: 'boolean' }).notNull().default(false),
    monthlyContribution: real('monthly_contribution').notNull().default(0),
    /** latest known balance — kept in sync with the most recent snapshot's end_balance */
    currentBalance: real('current_balance'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('accounts_household_id_idx').on(t.householdId),
    index('accounts_person_id_idx').on(t.personId),
    check('accounts_owner_check', sql`${t.owner} in ('person_a','person_b','joint')`),
    check(
      'accounts_account_type_check',
      sql`${t.accountType} in ('cash_isa','stocks_isa','pension','lisa','savings_account','other')`,
    ),
    check(
      'accounts_pot_category_check',
      sql`${t.potCategory} in ('pension','investments','cash')`,
    ),
    // joint accounts have no single owner; every other account must have one
    check(
      'accounts_owner_person_id_check',
      sql`(${t.owner} = 'joint' AND ${t.personId} IS NULL) OR (${t.owner} != 'joint' AND ${t.personId} IS NOT NULL)`,
    ),
  ],
)

// ── account_snapshots ─────────────────────────────────────────────────────
// Point-in-time balance updates per account. Append-only — this module exposes
// no update or delete for this table, only insert and read (see accountSnapshots.ts).
//
// money_in and transfer_out are kept as two separate, nullable fields rather than
// one net contribution figure — netting them client-side would hide that a
// withdrawal and a contribution both happened in the same period, which the "how
// we worked this out" drawer must be able to show distinctly. True market growth
// for a period is ALWAYS end_balance − start_balance − money_in + transfer_out,
// never a raw balance diff (see accountSnapshots.ts's growth calculation).

export const accountSnapshots = sqliteTable(
  'account_snapshots',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    recordedAt: text('recorded_at').notNull(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    /** balance at the start of this period */
    startBalance: real('start_balance').notNull(),
    /** new money added this period (contributions, transfers in) — nullable: an
     *  absent value is a real "unknown," not a zero (see accountSnapshots.ts) */
    moneyIn: real('money_in'),
    /** money removed this period (withdrawals, transfers out) — nullable, same reasoning */
    transferOut: real('transfer_out'),
    /** balance at the end of this period — the authoritative "today's balance" figure */
    endBalance: real('end_balance').notNull(),
    /** true if moneyIn/transferOut were auto-filled and NOT confirmed/corrected */
    isEstimated: integer('is_estimated', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
  },
  (t) => [
    index('account_snapshots_account_id_idx').on(t.accountId),
    index('account_snapshots_account_period_idx').on(t.accountId, t.year, t.month),
  ],
)

// ── forecast_snapshots ────────────────────────────────────────────────────
// The baseline/actuals/replan model. A "baseline" is the plan-of-record; only
// ever created on explicit user action (or the one-time auto-creation on first
// visit to Forecast — see forecastSnapshots.ts). Stores a full serialised copy of
// household + people + accounts state so later changes never retroactively alter
// what the baseline said.

// 'checkpoint' added for /app2: a low-friction, no-note-required check-in
// that (like a replan) becomes the new plan-of-record — see
// forecastSnapshots.ts's createCheckpoint. getCurrentBaseline/
// getOriginalBaseline below need no changes: "most recent row of any type"
// already resolves a checkpoint correctly. Known cosmetic gap this creates:
// /app/forecast.tsx's old "You replanned" banner (untouched, per plan) will
// show that copy even when the divergence was actually a checkpoint — left
// as-is for the Phase 15 cross-cutting pass rather than touching /app here.
export const FORECAST_SNAPSHOT_TYPES = ['baseline', 'replan', 'checkpoint'] as const
export type ForecastSnapshotType = (typeof FORECAST_SNAPSHOT_TYPES)[number]

export const forecastSnapshots = sqliteTable(
  'forecast_snapshots',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    createdAt: text('created_at').notNull(),
    type: text('type').notNull().$type<ForecastSnapshotType>(),
    /** full serialised Household + People + Accounts at the moment this was set */
    householdStateJson: text('household_state_json').notNull(),
    note: text('note'),
  },
  (t) => [
    index('forecast_snapshots_household_id_idx').on(t.householdId),
    check('forecast_snapshots_type_check', sql`${t.type} in ('baseline','replan','checkpoint')`),
  ],
)

// ── contribution_changes ──────────────────────────────────────────────────
// A live, editable schedule of future changes to one pot's monthly
// contribution — powers the Plan table's own live projection, entirely
// separate from forecast_snapshots' frozen baseline/replan model. Unlike
// account_snapshots this is NOT append-only: it's a working plan, not a
// historical record, so rows are freely updated/deleted (see
// contributionChanges.ts).

export const CONTRIBUTION_CHANGE_TYPES = ['set', 'grow_pct', 'annual_bonus'] as const
export type ContributionChangeType = (typeof CONTRIBUTION_CHANGE_TYPES)[number]

export const contributionChanges = sqliteTable(
  'contribution_changes',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    owner: text('owner').notNull().$type<AccountOwner>(),
    potCategory: text('pot_category').notNull().$type<PotCategory>(),
    /** the calendar year this change first takes effect */
    effectiveYear: integer('effective_year').notNull(),
    changeType: text('change_type').notNull().$type<ContributionChangeType>(),
    /** 'set': new flat £/month. 'grow_pct': fractional annual growth (0.01 =
     *  1%), applied every year from effectiveYear onward until superseded.
     *  'annual_bonus': a flat £ added once a year (not monthly) every year
     *  from effectiveYear onward until superseded — see scheduledPlan.ts's
     *  resolveMonthlySchedule/resolveAnnualBonusSchedule for the exact math. */
    value: real('value').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('contribution_changes_household_id_idx').on(t.householdId),
    check('contribution_changes_owner_check', sql`${t.owner} in ('person_a','person_b','joint')`),
    check(
      'contribution_changes_pot_category_check',
      sql`${t.potCategory} in ('pension','investments','cash')`,
    ),
    check(
      'contribution_changes_change_type_check',
      sql`${t.changeType} in ('set','grow_pct','annual_bonus')`,
    ),
  ],
)

// ── planned_events ────────────────────────────────────────────────────────
// One-off amounts in or out of a pot at a specific year — a house deposit, a
// big purchase — layered onto the live Plan projection alongside
// contribution_changes. Same editable/deletable reasoning as above.

export const plannedEvents = sqliteTable(
  'planned_events',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    owner: text('owner').notNull().$type<AccountOwner>(),
    potCategory: text('pot_category').notNull().$type<PotCategory>(),
    year: integer('year').notNull(),
    name: text('name').notNull(),
    /** positive = money in, negative = money out */
    amount: real('amount').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('planned_events_household_id_idx').on(t.householdId),
    check('planned_events_owner_check', sql`${t.owner} in ('person_a','person_b','joint')`),
    check('planned_events_pot_category_check', sql`${t.potCategory} in ('pension','investments','cash')`),
  ],
)
