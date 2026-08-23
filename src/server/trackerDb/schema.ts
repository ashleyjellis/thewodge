/**
 * Database schema — the managed portfolio performance tracker.
 *
 * A THIRD database, separate from both the household app (src/server/db) and
 * the provider pricing archive (src/server/archiveDb). Two reasons, and the
 * first is not merely tidiness: this schema defines its own `providers`
 * table, which collides by name with the archive's. The second is that this
 * database holds fabricated demo data — fictional firms, invented
 * performance — and that must never sit in the same place as real archived
 * pricing where a careless join or an export could mix them.
 *
 * ## Money is never a float
 *
 * The source brief's first non-negotiable, and the one thing here that most
 * differs from the rest of this codebase. Every currency amount is an
 * `INTEGER` of pence. Every unit price and unit count is an `INTEGER` scaled
 * by 1,000,000 (micro-units). Basis points are integers too (75 = 0.75%).
 * Nothing is formatted until the last possible moment.
 *
 * src/server/db/schema.ts stores money as `real()`, and that is deliberately
 * NOT a precedent to follow here. That app projects forward from estimates,
 * where a rounding difference is invisible against the uncertainty. This one
 * publishes a compounding series as a verified record: cumulative products on
 * floats drift, and drift in a series presented as evidence is fatal to the
 * whole point of it.
 *
 * ## Readings and flows are the only source of truth
 *
 * Unit price, returns, volatility and drawdown are all DERIVED. Nothing
 * derived is ever stored as though a human entered it. `series_cache` exists
 * purely as a rebuildable projection of `readings` + `flows`, and can be
 * dropped and regenerated at any time without losing anything.
 *
 * ## No automated collection, by design
 *
 * Every reading is entered by a human who looked at a screen. That is a
 * compliance and terms-of-service position rather than a technical
 * limitation, and `readings.read_at` and `readings.source` exist as
 * first-class fields to record it. Note the deliberate contrast with the
 * pricing archive in this same repository, which does crawl: these are
 * different products with different postures, and the difference is
 * intentional.
 */
import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`

/**
 * Integer primary keys with AUTOINCREMENT, as the brief specifies — rather
 * than this project's usual TEXT uuids. The rows are human-entered and
 * naturally sequential. AUTOINCREMENT (over SQLite's bare rowid alias) means
 * a deleted row's id is never reused, so a reading id in a screenshot, an
 * export or a note can never later point at a different reading.
 */
const pk = () => integer('id').primaryKey({ autoIncrement: true })

// ── providers ─────────────────────────────────────────────────────────────

export const providers = sqliteTable('providers', {
  id: pk(),
  /** URL slug, e.g. 'northgate' */
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  website: text('website'),
  /** fictional provider carrying fabricated figures — never a real firm */
  isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(nowIso),
})

// ── portfolios ────────────────────────────────────────────────────────────

export const STYLE_FAMILIES = ['mainstream', 'sri', 'thematic', 'fixed_allocation'] as const
export type StyleFamily = (typeof STYLE_FAMILIES)[number]

export const WRAPPERS = ['isa', 'gia', 'sipp'] as const
export type Wrapper = (typeof WRAPPERS)[number]

export const portfolios = sqliteTable(
  'portfolios',
  {
    id: pk(),
    providerId: integer('provider_id')
      .notNull()
      .references(() => providers.id),
    /** e.g. 'fully-managed-5' */
    slug: text('slug').notNull(),
    /** e.g. 'Fully Managed' */
    name: text('name').notNull(),
    /** exactly as the provider prints it, e.g. '5/10' — never normalised into
     *  a scale of our own, because comparing providers' self-assigned risk
     *  labels is precisely the thing that cannot be done honestly */
    providerRiskLabel: text('provider_risk_label'),
    styleFamily: text('style_family').$type<StyleFamily>(),
    wrapper: text('wrapper').$type<Wrapper>(),
    /** the date cash was actually invested — where the series begins */
    inceptionDate: text('inception_date').notNull(),
    /** often 2-5 days before inception; kept because the gap is itself a
     *  finding worth publishing */
    accountOpenDate: text('account_open_date'),
    initialPence: integer('initial_pence').notNull(),
    /** flat annual platform fee in basis points (75 = 0.75%/yr); null when
     *  the provider charges on tiers instead — see feeTiersJson */
    platformFeeBps: integer('platform_fee_bps'),
    /** [{"upto_pence":10000000,"bps":75},{"upto_pence":null,"bps":35}] */
    feeTiersJson: text('fee_tiers_json'),
    /** ongoing charges figure — already inside the observed unit price, so
     *  this is for display only and must never be applied in the fee model */
    ocfBps: integer('ocf_bps'),
    /** 'active' by default; values beyond that are deliberately unconstrained
     *  since the brief does not enumerate them */
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    unique('portfolios_provider_slug_unique').on(t.providerId, t.slug),
    index('portfolios_provider_id_idx').on(t.providerId),
    check(
      'portfolios_style_family_check',
      sql`${t.styleFamily} is null or ${t.styleFamily} in ('mainstream','sri','thematic','fixed_allocation')`,
    ),
    check(
      'portfolios_wrapper_check',
      sql`${t.wrapper} is null or ${t.wrapper} in ('isa','gia','sipp')`,
    ),
  ],
)

// ── readings ──────────────────────────────────────────────────────────────
// A human looked at a screen and wrote down what it said. The two dates are
// genuinely different and must not be conflated: valuation_date is what the
// PROVIDER says the value is as of, read_at is when WE looked. A provider
// showing Friday's value on Monday makes those three days apart.

export const READING_SOURCES = ['web', 'app', 'statement'] as const
export type ReadingSource = (typeof READING_SOURCES)[number]

export const readings = sqliteTable(
  'readings',
  {
    id: pk(),
    portfolioId: integer('portfolio_id')
      .notNull()
      .references(() => portfolios.id),
    valuationDate: text('valuation_date').notNull(),
    readAt: text('read_at').notNull(),
    valuePence: integer('value_pence').notNull(),
    /** micro-units, only when the provider actually displays a unit count */
    unitsReported: integer('units_reported'),
    cashPence: integer('cash_pence'),
    source: text('source').notNull().$type<ReadingSource>(),
    /** object key for the screenshot backing this reading */
    evidenceKey: text('evidence_key'),
    note: text('note'),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    unique('readings_portfolio_valuation_unique').on(t.portfolioId, t.valuationDate),
    index('readings_portfolio_valuation_idx').on(t.portfolioId, t.valuationDate),
    check('readings_source_check', sql`${t.source} in ('web','app','statement')`),
  ],
)

// ── flows ─────────────────────────────────────────────────────────────────
// Money in or out. A flow adds units at the last known unit price strictly
// before its effective date and leaves the price itself untouched — that is
// the entire mechanism separating time-weighted from simple return.

export const FLOW_KINDS = ['initial', 'contribution', 'withdrawal'] as const
export type FlowKind = (typeof FLOW_KINDS)[number]

export const flows = sqliteTable(
  'flows',
  {
    id: pk(),
    portfolioId: integer('portfolio_id')
      .notNull()
      .references(() => portfolios.id),
    effectiveDate: text('effective_date').notNull(),
    /** negative for withdrawals */
    amountPence: integer('amount_pence').notNull(),
    kind: text('kind').notNull().$type<FlowKind>(),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    index('flows_portfolio_id_idx').on(t.portfolioId),
    check('flows_kind_check', sql`${t.kind} in ('initial','contribution','withdrawal')`),
  ],
)

// ── fee_events ────────────────────────────────────────────────────────────
// Charges actually observed on a statement, used to check the fee model
// against reality. If modelled fees drift more than ~10% from these, the rate
// card being modelled is wrong.

export const feeEvents = sqliteTable(
  'fee_events',
  {
    id: pk(),
    portfolioId: integer('portfolio_id')
      .notNull()
      .references(() => portfolios.id),
    chargedOn: text('charged_on').notNull(),
    amountPence: integer('amount_pence').notNull(),
    description: text('description'),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [index('fee_events_portfolio_id_idx').on(t.portfolioId)],
)

// ── holdings ──────────────────────────────────────────────────────────────
// Composition at a point in time — the part nobody else publishes.

export const ASSET_CLASSES = ['equity', 'bond', 'cash', 'property', 'alternative'] as const
export type AssetClass = (typeof ASSET_CLASSES)[number]

export const holdings = sqliteTable(
  'holdings',
  {
    id: pk(),
    portfolioId: integer('portfolio_id')
      .notNull()
      .references(() => portfolios.id),
    asOfDate: text('as_of_date').notNull(),
    isin: text('isin'),
    instrumentName: text('instrument_name').notNull(),
    assetClass: text('asset_class').notNull().$type<AssetClass>(),
    region: text('region'),
    /** basis points of the portfolio: 2500 = 25.00% */
    weightBps: integer('weight_bps').notNull(),
  },
  (t) => [
    unique('holdings_portfolio_date_instrument_unique').on(
      t.portfolioId,
      t.asOfDate,
      t.instrumentName,
    ),
    index('holdings_portfolio_date_idx').on(t.portfolioId, t.asOfDate),
    check(
      'holdings_asset_class_check',
      sql`${t.assetClass} in ('equity','bond','cash','property','alternative')`,
    ),
  ],
)

// ── benchmarks ────────────────────────────────────────────────────────────
// Reference series, used to express a portfolio's volatility relative to a
// global equity benchmark rather than as a bare number nobody can situate.

export const benchmarks = sqliteTable('benchmarks', {
  id: pk(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
})

export const benchmarkReadings = sqliteTable(
  'benchmark_readings',
  {
    id: pk(),
    benchmarkId: integer('benchmark_id')
      .notNull()
      .references(() => benchmarks.id),
    onDate: text('on_date').notNull(),
    /** index level scaled by 1,000,000 */
    levelMicro: integer('level_micro').notNull(),
  },
  (t) => [
    unique('benchmark_readings_benchmark_date_unique').on(t.benchmarkId, t.onDate),
    index('benchmark_readings_benchmark_date_idx').on(t.benchmarkId, t.onDate),
  ],
)

// ── series_cache ──────────────────────────────────────────────────────────
// Derived, and rebuilt from readings + flows on every write. Nothing here is
// authoritative; deleting the whole table loses nothing.
//
// is_forward_filled marks a date carried forward from the last known reading
// because no reading exists for it. Gaps are forward-filled and NEVER
// interpolated, and the flag exists so the chart can draw those stretches
// differently — a gap must read as a gap rather than be smoothed into a
// trend the data does not support.

export const seriesCache = sqliteTable(
  'series_cache',
  {
    portfolioId: integer('portfolio_id')
      .notNull()
      .references(() => portfolios.id),
    onDate: text('on_date').notNull(),
    unitPriceMicro: integer('unit_price_micro').notNull(),
    unitsMicro: integer('units_micro').notNull(),
    valuePence: integer('value_pence').notNull(),
    isForwardFilled: integer('is_forward_filled', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (t) => [
    primaryKey({ columns: [t.portfolioId, t.onDate] }),
    index('series_cache_portfolio_date_idx').on(t.portfolioId, t.onDate),
  ],
)

// ── notes ─────────────────────────────────────────────────────────────────
// The weekly write-up. portfolio_id is nullable: a note may be about one
// portfolio or about the whole project.

export const notes = sqliteTable('notes', {
  id: pk(),
  portfolioId: integer('portfolio_id').references(() => portfolios.id),
  publishedAt: text('published_at').notNull(),
  title: text('title').notNull(),
  bodyMd: text('body_md').notNull(),
  slug: text('slug').notNull().unique(),
})

// ── subscribers / alert_subscriptions ─────────────────────────────────────

export const subscribers = sqliteTable('subscribers', {
  id: pk(),
  email: text('email').notNull().unique(),
  /** null until double opt-in is completed */
  confirmedAt: text('confirmed_at'),
  unsubToken: text('unsub_token').notNull(),
  createdAt: text('created_at').notNull().default(nowIso),
})

export const alertSubscriptions = sqliteTable(
  'alert_subscriptions',
  {
    id: pk(),
    subscriberId: integer('subscriber_id')
      .notNull()
      .references(() => subscribers.id),
    portfolioId: integer('portfolio_id')
      .notNull()
      .references(() => portfolios.id),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    unique('alert_subscriptions_subscriber_portfolio_unique').on(
      t.subscriberId,
      t.portfolioId,
    ),
  ],
)

// ── admin_users ───────────────────────────────────────────────────────────
// Single operator expected for the foreseeable future. password_hash is a
// scrypt digest (see src/server/adminAuth.ts) — never a plaintext or
// reversible value.

export const adminUsers = sqliteTable('admin_users', {
  id: pk(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default(nowIso),
})
