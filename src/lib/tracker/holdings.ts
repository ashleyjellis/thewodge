/**
 * What a portfolio holds, and what changed since last month.
 *
 * The diff matters more than the snapshot. A pie chart of current allocation
 * is available from the provider; what nobody publishes is that cash went
 * from 2.6% to 4.1% between June and July, because that requires having
 * written down what it was before. It is the only thing on this site a
 * competitor cannot reproduce by scraping today's page.
 *
 * Rendered as sentences rather than a second table. "Cash 2.6% → 4.1%" is
 * read; a table of before-and-after weights is scanned and forgotten.
 */

/** Weights are integer basis points: 2500 = 25.00%. */
export type Holding = {
  asOfDate: string
  instrumentName: string
  assetClass: string
  region: string | null
  weightBps: number
  isin: string | null
}

export type AllocationSlice = {
  key: string
  weightBps: number
}

export type HoldingsSnapshot = {
  asOfDate: string
  holdings: Holding[]
  byAssetClass: AllocationSlice[]
  byRegion: AllocationSlice[]
  totalWeightBps: number
}

function group(holdings: Holding[], pick: (h: Holding) => string | null): AllocationSlice[] {
  const totals = new Map<string, number>()
  for (const holding of holdings) {
    // A holding with no region stated is grouped as unstated rather than
    // dropped: dropping it would make the weights silently fail to add up,
    // and the reader would have no way of telling.
    const key = pick(holding) ?? 'Not stated'
    totals.set(key, (totals.get(key) ?? 0) + holding.weightBps)
  }
  return [...totals.entries()]
    .map(([key, weightBps]) => ({ key, weightBps }))
    .sort((a, b) => b.weightBps - a.weightBps || a.key.localeCompare(b.key))
}

/** Groups one date's holdings into the two breakdowns the page shows. */
export function buildSnapshot(asOfDate: string, holdings: Holding[]): HoldingsSnapshot {
  return {
    asOfDate,
    holdings: [...holdings].sort((a, b) => b.weightBps - a.weightBps),
    byAssetClass: group(holdings, (h) => h.assetClass),
    byRegion: group(holdings, (h) => h.region),
    totalWeightBps: holdings.reduce((sum, h) => sum + h.weightBps, 0),
  }
}

/** Every snapshot in the data, newest first. */
export function snapshotsByDate(holdings: Holding[]): HoldingsSnapshot[] {
  const dates = [...new Set(holdings.map((h) => h.asOfDate))].sort().reverse()
  return dates.map((date) =>
    buildSnapshot(
      date,
      holdings.filter((h) => h.asOfDate === date),
    ),
  )
}

export type WeightChange = {
  key: string
  fromBps: number
  toBps: number
  deltaBps: number
}

export type HoldingsDiff = {
  fromDate: string
  toDate: string
  /** asset-class weights that moved, largest movement first */
  assetClassChanges: WeightChange[]
  regionChanges: WeightChange[]
  added: Holding[]
  removed: Holding[]
  /** true when nothing moved by more than the threshold and nothing changed hands */
  isQuiet: boolean
}

/**
 * Movements below this are not reported.
 *
 * 25 basis points — a quarter of a percentage point. Below that the change is
 * as likely to be the market moving the weights as the manager moving the
 * money, and reporting it as a decision would be reading intent into drift.
 */
export const MATERIAL_MOVE_BPS = 25

function diffSlices(
  from: AllocationSlice[],
  to: AllocationSlice[],
  thresholdBps: number,
): WeightChange[] {
  const keys = new Set([...from.map((s) => s.key), ...to.map((s) => s.key)])
  const changes: WeightChange[] = []

  for (const key of keys) {
    const fromBps = from.find((s) => s.key === key)?.weightBps ?? 0
    const toBps = to.find((s) => s.key === key)?.weightBps ?? 0
    const deltaBps = toBps - fromBps
    if (Math.abs(deltaBps) >= thresholdBps) changes.push({ key, fromBps, toBps, deltaBps })
  }

  return changes.sort((a, b) => Math.abs(b.deltaBps) - Math.abs(a.deltaBps))
}

export function diffSnapshots(
  previous: HoldingsSnapshot,
  current: HoldingsSnapshot,
  thresholdBps = MATERIAL_MOVE_BPS,
): HoldingsDiff {
  const previousNames = new Set(previous.holdings.map((h) => h.instrumentName))
  const currentNames = new Set(current.holdings.map((h) => h.instrumentName))

  const assetClassChanges = diffSlices(previous.byAssetClass, current.byAssetClass, thresholdBps)
  const regionChanges = diffSlices(previous.byRegion, current.byRegion, thresholdBps)
  const added = current.holdings.filter((h) => !previousNames.has(h.instrumentName))
  const removed = previous.holdings.filter((h) => !currentNames.has(h.instrumentName))

  return {
    fromDate: previous.asOfDate,
    toDate: current.asOfDate,
    assetClassChanges,
    regionChanges,
    added,
    removed,
    isQuiet:
      assetClassChanges.length === 0 &&
      regionChanges.length === 0 &&
      added.length === 0 &&
      removed.length === 0,
  }
}

// ── rendering the diff as sentences ───────────────────────────────────────

/** 410 -> "4.1%" */
export function formatWeight(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`
}

/** 150 -> "1.5 points" */
function formatPoints(bps: number): string {
  const points = Math.abs(bps) / 100
  return `${points.toFixed(1)} point${points === 1 ? '' : 's'}`
}

/**
 * The diff as plain sentences.
 *
 * Two forms, deliberately. A weight that moved gets its before and after
 * because the reader wants the level ("cash is now 4.1%"); a direction gets
 * the size of the move because they want the change. Mixing the two
 * arbitrarily would read as noise.
 */
export function describeDiff(diff: HoldingsDiff): string[] {
  const lines: string[] = []

  // Only the first character, never a full title-case: asset classes are
  // stored lowercase ("equity") and need lifting to start a sentence, while
  // regions are already written as they should read and "UK" must not come
  // back as "Uk".
  const lead = (key: string) => key.charAt(0).toUpperCase() + key.slice(1)

  for (const change of diff.assetClassChanges) {
    lines.push(
      `${lead(change.key)} ${formatWeight(change.fromBps)} → ${formatWeight(change.toBps)}.`,
    )
  }

  for (const change of diff.regionChanges) {
    lines.push(
      `${lead(change.key)} ${change.deltaBps > 0 ? 'up' : 'down'} ${formatPoints(change.deltaBps)}.`,
    )
  }

  if (diff.added.length > 0 || diff.removed.length > 0) {
    const parts: string[] = []
    if (diff.added.length > 0) {
      parts.push(`${diff.added.length} holding${diff.added.length === 1 ? '' : 's'} added`)
    }
    if (diff.removed.length > 0) {
      parts.push(`${diff.removed.length} removed`)
    }
    lines.push(`${parts.join(', ')}.`)
  }

  return lines
}

/**
 * Whether a diff is big enough to be worth a changelog entry.
 *
 * The changelog mixes deliberate entries with generated ones, and a feed
 * where every month says "European equity down 0.3 points" trains the reader
 * to skip it. One percentage point is a decision; a quarter of one is drift.
 */
export const CHANGELOG_MOVE_BPS = 100

export function isChangelogWorthy(diff: HoldingsDiff): boolean {
  if (diff.added.length > 0 || diff.removed.length > 0) return true
  return [...diff.assetClassChanges, ...diff.regionChanges].some(
    (change) => Math.abs(change.deltaBps) >= CHANGELOG_MOVE_BPS,
  )
}
