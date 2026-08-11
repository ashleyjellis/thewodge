/**
 * Database schema — the provider pricing archive (Turso/libSQL via Drizzle).
 *
 * A SEPARATE database from src/server/db/schema.ts (the household/people/
 * accounts app). Deliberately isolated: an unattended scraper+LLM pipeline
 * writes here on a schedule, and it must never share credentials or blast
 * radius with the database holding real user financial data. See
 * src/server/archiveDb/client.ts for the connection (same local-fallback
 * pattern as the main app's client, different env vars).
 *
 * Seven tables, matching the source brief's schema exactly. Timestamps here
 * DO carry a DB-level default (`strftime('%Y-%m-%dT%H:%M:%SZ','now')`),
 * unlike src/server/db/schema.ts's app-set-only convention — deliberate,
 * because unlike the main app (written only through one TS data-access
 * layer), this database is written to from two independent paths (the
 * Python pipeline's raw SQL, and this TS admin UI), so a DB-level default is
 * a safety net rather than something every caller must remember. An
 * explicit value passed by either caller still wins; DEFAULT only fires when
 * a column is omitted from the INSERT.
 *
 * Partial-index WHERE clauses and CHECK constraints are both supported by
 * this drizzle-orm version's sqlite-core builders — used throughout, per
 * the brief. Index columns are declared plain-ascending rather than with an
 * explicit DESC modifier: SQLite's B-tree indexes scan efficiently in either
 * direction regardless of declared order, so this is a cosmetic
 * simplification, not a functional gap.
 */
import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`

// ── providers ─────────────────────────────────────────────────────────────

export const PROVIDER_TYPES = [
  'platform',
  'bank',
  'asset_manager',
  'robo',
  'life_company',
  'neo_broker',
] as const
export type ProviderType = (typeof PROVIDER_TYPES)[number]

export const providers = sqliteTable(
  'providers',
  {
    /** slug, e.g. 'hargreaves-lansdown' — application-assigned, not a uuid */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    legalEntity: text('legal_entity'),
    fcaFrn: text('fca_frn'),
    providerType: text('provider_type').notNull().$type<ProviderType>(),
    website: text('website'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    /** only auto-set on insert — SQLite has no auto-update-on-UPDATE trigger
     *  here, so update code must set this explicitly */
    updatedAt: text('updated_at').notNull().default(nowIso),
  },
  (t) => [
    check(
      'providers_provider_type_check',
      sql`${t.providerType} in ('platform','bank','asset_manager','robo','life_company','neo_broker')`,
    ),
  ],
)

// ── sources ───────────────────────────────────────────────────────────────
// The pages/documents being watched. is_authoritative marks PDF rate cards —
// the highest-trust source type when one exists for a provider.

export const SOURCE_TYPES = ['html', 'pdf'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const FETCH_METHODS = ['http', 'playwright'] as const
export type FetchMethod = (typeof FETCH_METHODS)[number]

export const CHECK_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
export type CheckFrequency = (typeof CHECK_FREQUENCIES)[number]

export const sources = sqliteTable(
  'sources',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    url: text('url').notNull(),
    sourceType: text('source_type').notNull().$type<SourceType>(),
    /** e.g. 'ISA charges', 'SIPP rate card' */
    label: text('label').notNull(),
    isAuthoritative: integer('is_authoritative', { mode: 'boolean' }).notNull().default(false),
    fetchMethod: text('fetch_method').notNull().default('http').$type<FetchMethod>(),
    /** CSS selector narrowing the captured subtree before normalisation, when set */
    contentSelector: text('content_selector'),
    checkFrequency: text('check_frequency').notNull().default('weekly').$type<CheckFrequency>(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    lastCheckedAt: text('last_checked_at'),
    lastChangedAt: text('last_changed_at'),
    /** flagged as needing attention in the admin UI once this hits 3 */
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    index('idx_sources_active_freq')
      .on(t.checkFrequency, t.lastCheckedAt)
      .where(sql`${t.isActive} = 1`),
    check('sources_source_type_check', sql`${t.sourceType} in ('html','pdf')`),
    check('sources_fetch_method_check', sql`${t.fetchMethod} in ('http','playwright')`),
    check(
      'sources_check_frequency_check',
      sql`${t.checkFrequency} in ('daily','weekly','monthly')`,
    ),
  ],
)

// ── snapshots ─────────────────────────────────────────────────────────────
// Immutable, append-only capture record — one row per fetch attempt,
// changed or not (proof of continuity is itself evidence). Never updated or
// deleted. The raw bytes live in object storage (R2 in production, a local
// file store in dev/test — see pipeline/storage.py); this table stores only
// the hash and the object key, never a blob.

export const snapshots = sqliteTable(
  'snapshots',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    /** when WE fetched, not any date printed on the page */
    observedAt: text('observed_at').notNull(),
    httpStatus: integer('http_status'),
    /** hash of the NORMALISED content — what change-detection compares */
    contentSha256: text('content_sha256').notNull(),
    /** hash of the raw bytes as fetched, before normalisation */
    rawSha256: text('raw_sha256').notNull(),
    /** R2 object key: snapshots/{provider_id}/{source_id}/{YYYY}/{MM}/{DD}/{snapshot_id}.{ext} */
    storageKey: text('storage_key').notNull(),
    byteSize: integer('byte_size'),
    contentType: text('content_type'),
    /** differs from the previous snapshot for this source */
    isChange: integer('is_change', { mode: 'boolean' }).notNull().default(false),
    fetchError: text('fetch_error'),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    index('idx_snapshots_source_time').on(t.sourceId, t.observedAt),
    index('idx_snapshots_hash').on(t.sourceId, t.contentSha256),
    index('idx_snapshots_changes').on(t.observedAt).where(sql`${t.isChange} = 1`),
  ],
)

// ── charges ───────────────────────────────────────────────────────────────
// The core bitemporal fact table. Two time dimensions, genuinely different,
// never conflated: effective_from/effective_to = when the PROVIDER's price
// applied; observed_at/superseded_at = when WE recorded it. A provider can
// announce a change weeks before it takes effect — both facts matter and
// must stay distinguishable.
//
// composite_key is a STORED generated column (provider_id|wrapper|
// asset_type|charge_type|product_name) — the queryable/indexable identity
// of "this particular charge line," independent of any one time-versioned
// row. Generated by SQLite itself from the four+one identity columns; never
// written directly.

export const WRAPPERS = ['isa', 'sipp', 'gia', 'lisa', 'jisa', 'jsipp', 'cash_isa', 'any'] as const
export type Wrapper = (typeof WRAPPERS)[number]

export const ASSET_TYPES = ['funds', 'listed_securities', 'both', 'cash', 'n/a'] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const CHARGE_TYPES = [
  'platform_percentage',
  'platform_flat',
  'account_fee',
  'dealing_fund',
  'dealing_share',
  'dealing_regular',
  'fx_fee',
  'exit_fee',
  'transfer_out_fee',
  'drawdown_fee',
  'inactivity_fee',
  'ready_made_ocf',
  'ready_made_service',
  'cash_interest_paid',
  'subscription',
  'other',
] as const
export type ChargeType = (typeof CHARGE_TYPES)[number]

export const VALUE_TYPES = ['percentage', 'fixed_gbp', 'tiered', 'free', 'conditional'] as const
export type ValueType = (typeof VALUE_TYPES)[number]

export const VERIFICATION_STATUSES = [
  'pending',
  'approved',
  'disputed',
  'corrected',
  'withdrawn',
] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export const charges = sqliteTable(
  'charges',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),

    wrapper: text('wrapper').notNull().$type<Wrapper>(),
    assetType: text('asset_type').notNull().$type<AssetType>(),
    chargeType: text('charge_type').notNull().$type<ChargeType>(),
    /** ready-made / named plans only */
    productName: text('product_name'),
    /** STORED generated column — see table comment above. Computed by
     *  SQLite itself from the four identity columns; never written to. */
    compositeKey: text('composite_key').generatedAlwaysAs(
      sql`("provider_id" || '|' || "wrapper" || '|' || "asset_type" || '|' || "charge_type" || '|' || coalesce("product_name",''))`,
      { mode: 'stored' },
    ),

    valueType: text('value_type').notNull().$type<ValueType>(),
    /** simple values; null when valueType is 'tiered' */
    valueNumeric: real('value_numeric'),
    /** tier structure JSON (as TEXT — see review_queue's comment on JSON
     *  columns below); { tiers: [{from_gbp,to_gbp,rate_pct}], basis:
     *  'marginal'|'whole' } */
    valueJson: text('value_json'),
    currency: text('currency').notNull().default('GBP'),

    capGbpAnnual: real('cap_gbp_annual'),
    floorGbpAnnual: real('floor_gbp_annual'),
    capScope: text('cap_scope'),

    conditions: text('conditions'),
    isPromotional: integer('is_promotional', { mode: 'boolean' }).notNull().default(false),
    promoEndsAt: text('promo_ends_at'),

    // bitemporal — see table comment above
    effectiveFrom: text('effective_from').notNull(),
    /** null = currently in force */
    effectiveTo: text('effective_to'),
    observedAt: text('observed_at').notNull(),
    /** when WE recorded that this row was replaced by a newer one */
    supersededAt: text('superseded_at'),

    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => snapshots.id),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    sourceQuote: text('source_quote'),
    extractionConfidence: real('extraction_confidence'),
    verificationStatus: text('verification_status')
      .notNull()
      .default('pending')
      .$type<VerificationStatus>(),
    verifiedBy: text('verified_by'),
    verifiedAt: text('verified_at'),

    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    index('idx_charges_composite').on(t.compositeKey, t.effectiveFrom),
    index('idx_charges_current')
      .on(t.compositeKey)
      .where(sql`${t.effectiveTo} is null and ${t.verificationStatus} = 'approved'`),
    index('idx_charges_provider').on(t.providerId, t.wrapper, t.effectiveFrom),
    index('idx_charges_pending')
      .on(t.createdAt)
      .where(sql`${t.verificationStatus} = 'pending'`),
    check('charges_wrapper_check', sql`${t.wrapper} in ('isa','sipp','gia','lisa','jisa','jsipp','cash_isa','any')`),
    check(
      'charges_asset_type_check',
      sql`${t.assetType} in ('funds','listed_securities','both','cash','n/a')`,
    ),
    check(
      'charges_charge_type_check',
      sql`${t.chargeType} in ('platform_percentage','platform_flat','account_fee','dealing_fund','dealing_share','dealing_regular','fx_fee','exit_fee','transfer_out_fee','drawdown_fee','inactivity_fee','ready_made_ocf','ready_made_service','cash_interest_paid','subscription','other')`,
    ),
    check(
      'charges_value_type_check',
      sql`${t.valueType} in ('percentage','fixed_gbp','tiered','free','conditional')`,
    ),
    check(
      'charges_verification_status_check',
      sql`${t.verificationStatus} in ('pending','approved','disputed','corrected','withdrawn')`,
    ),
  ],
)

// ── change_events ─────────────────────────────────────────────────────────
// The newsletter/PR feed — a human-readable summary of a detected change,
// distinct from the raw charges rows it's built from.

export const CHANGE_DIRECTIONS = [
  'increase',
  'decrease',
  'mixed',
  'structural',
  'new',
  'withdrawn',
] as const
export type ChangeDirection = (typeof CHANGE_DIRECTIONS)[number]

export const changeEvents = sqliteTable(
  'change_events',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    detectedAt: text('detected_at').notNull(),
    announcedAt: text('announced_at'),
    effectiveAt: text('effective_at'),
    headline: text('headline'),
    summary: text('summary'),
    direction: text('direction').$type<ChangeDirection>(),
    /** JSON array of affected charges.id, as TEXT */
    chargeIds: text('charge_ids'),
    beforeSnapshotId: text('before_snapshot_id').references(() => snapshots.id),
    afterSnapshotId: text('after_snapshot_id').references(() => snapshots.id),
    isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    check(
      'change_events_direction_check',
      sql`${t.direction} is null or ${t.direction} in ('increase','decrease','mixed','structural','new','withdrawn')`,
    ),
  ],
)

// ── corrections ───────────────────────────────────────────────────────────
// Public corrections log — evidence of reasonable care.

export const corrections = sqliteTable('corrections', {
  id: text('id').primaryKey(),
  chargeId: text('charge_id').references(() => charges.id),
  providerId: text('provider_id').references(() => providers.id),
  /** 'provider' | 'user' | 'internal' — free text per the brief, not CHECK'd */
  reportedBy: text('reported_by'),
  reportedAt: text('reported_at').notNull(),
  description: text('description').notNull(),
  resolution: text('resolution'),
  resolvedAt: text('resolved_at'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
})

// ── review_queue ──────────────────────────────────────────────────────────
// Every extracted charge passes through here before it can ever become a
// `charges` row — the mandatory human-approval gate (see the brief's Stage
// 4). Nothing in this codebase writes to `charges` except the review
// approval path built in Phase 7.
//
// extraction_a/extraction_b are JSON (as TEXT, not drizzle's {mode:'json'}
// column type) — matching src/server/db/schema.ts's own
// household_state_json convention: encode/decode explicitly in the
// data-access layer, not implicitly via the ORM.

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'needs_info'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const reviewQueue = sqliteTable(
  'review_queue',
  {
    id: text('id').primaryKey(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => snapshots.id),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    status: text('status').notNull().default('pending').$type<ReviewStatus>(),
    extractionA: text('extraction_a'),
    extractionB: text('extraction_b'),
    agreementScore: real('agreement_score'),
    diffSummary: text('diff_summary'),
    /** which extraction prompt version produced this row — not in the
     *  brief's own §3.7 column list, but required by its §4 Stage 3 text
     *  ("store the prompt version used against each extraction... this is
     *  why raw snapshots are retained"); added to reconcile the brief with
     *  its own stated requirement, not new scope */
    promptVersion: text('prompt_version'),
    reviewerNotes: text('reviewer_notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    reviewedAt: text('reviewed_at'),
  },
  (t) => [
    index('idx_queue_pending').on(t.createdAt).where(sql`${t.status} = 'pending'`),
    check(
      'review_queue_status_check',
      sql`${t.status} in ('pending','approved','rejected','needs_info')`,
    ),
  ],
)
