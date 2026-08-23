/**
 * Reading writes, and the derived series they feed.
 *
 * `series_cache` is rebuilt from readings and flows rather than updated in
 * place. It is a projection, not a record: rebuilding is cheap at this size,
 * always correct, and removes any possibility of the cache and its source
 * disagreeing — which is the failure a published series can least afford.
 */
import { and, eq, inArray } from 'drizzle-orm'
import { buildSeries } from '@/lib/tracker/series'
import type { TrackerDb } from './client'
import { flows, portfolios, readings, seriesCache } from './schema'
import type { ReadingSource } from './schema'

export type ReadingDraft = {
  portfolioId: number
  valuationDate: string
  valuePence: number
  source: ReadingSource
  note?: string | null
}

export type SaveResult = {
  saved: number
  replaced: number
  portfolioIds: number[]
}

/**
 * Saves a batch of readings and rebuilds the affected series.
 *
 * Atomic by design: a weekly entry across a dozen portfolios that half-applied
 * would leave the operator with no idea which rows landed, and the natural
 * response — entering everything again — would double-write the half that
 * did. All of it, or none of it.
 *
 * A reading for a date that already exists replaces it rather than failing on
 * the unique constraint. Re-entering a value is a correction, and corrections
 * are ordinary: a provider restating a valuation is exactly the kind of thing
 * this archive should be able to record.
 */
export async function saveReadings(
  db: TrackerDb,
  drafts: ReadingDraft[],
  readAt = new Date().toISOString().slice(0, 19) + 'Z',
): Promise<SaveResult> {
  if (drafts.length === 0) return { saved: 0, replaced: 0, portfolioIds: [] }

  const portfolioIds = [...new Set(drafts.map((d) => d.portfolioId))]
  let replaced = 0

  await db.transaction(async (tx) => {
    for (const draft of drafts) {
      // Matched on the pair, not on either half: a different portfolio
      // sharing this valuation date is not a duplicate, and treating it as
      // one would overwrite another portfolio's reading.
      const [duplicate] = await tx
        .select({ id: readings.id })
        .from(readings)
        .where(
          and(
            eq(readings.portfolioId, draft.portfolioId),
            eq(readings.valuationDate, draft.valuationDate),
          ),
        )

      if (duplicate) {
        await tx
          .update(readings)
          .set({
            valuePence: draft.valuePence,
            source: draft.source,
            note: draft.note ?? null,
            readAt,
          })
          .where(eq(readings.id, duplicate.id))
        replaced++
      } else {
        await tx.insert(readings).values({
          portfolioId: draft.portfolioId,
          valuationDate: draft.valuationDate,
          readAt,
          valuePence: draft.valuePence,
          source: draft.source,
          note: draft.note ?? null,
        })
      }
    }
  })

  for (const portfolioId of portfolioIds) {
    await rebuildSeriesCache(db, portfolioId)
  }

  return { saved: drafts.length, replaced, portfolioIds }
}

/** Recomputes one portfolio's cached series from its readings and flows. */
export async function rebuildSeriesCache(db: TrackerDb, portfolioId: number): Promise<number> {
  const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, portfolioId))
  if (!portfolio) return 0

  const portfolioReadings = await db
    .select({ valuationDate: readings.valuationDate, valuePence: readings.valuePence })
    .from(readings)
    .where(eq(readings.portfolioId, portfolioId))

  const portfolioFlows = await db
    .select({
      effectiveDate: flows.effectiveDate,
      amountPence: flows.amountPence,
      kind: flows.kind,
    })
    .from(flows)
    .where(eq(flows.portfolioId, portfolioId))

  const points = buildSeries({
    inceptionDate: portfolio.inceptionDate,
    initialPence: portfolio.initialPence,
    readings: portfolioReadings,
    flows: portfolioFlows,
  })

  await db.delete(seriesCache).where(eq(seriesCache.portfolioId, portfolioId))
  if (points.length > 0) {
    await db.insert(seriesCache).values(
      points.map((point) => ({
        portfolioId,
        onDate: point.onDate,
        unitPriceMicro: point.unitPriceMicro,
        unitsMicro: point.unitsMicro,
        valuePence: point.valuePence,
        isForwardFilled: point.isForwardFilled,
      })),
    )
  }
  return points.length
}

export async function rebuildAllSeriesCaches(db: TrackerDb): Promise<number> {
  const all = await db.select({ id: portfolios.id }).from(portfolios)
  let total = 0
  for (const { id } of all) total += await rebuildSeriesCache(db, id)
  return total
}

export async function listReadings(db: TrackerDb, portfolioId: number) {
  return db
    .select()
    .from(readings)
    .where(eq(readings.portfolioId, portfolioId))
    .orderBy(readings.valuationDate)
}

export async function readingsForPortfolios(db: TrackerDb, portfolioIds: number[]) {
  if (portfolioIds.length === 0) return []
  return db.select().from(readings).where(inArray(readings.portfolioId, portfolioIds))
}
