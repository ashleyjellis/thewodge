/**
 * Building the unit-price series — the mechanism everything else depends on.
 *
 * From the brief:
 *
 *     units(inception) = initial_pence      // so unit_price starts at 1.000000
 *     unit_price(t)    = value_pence(t) / units(t)
 *
 *     On a flow of amount A effective date d:
 *       units_added = A / unit_price(last known date strictly before d)
 *       units(d)    = units(d-1) + units_added
 *
 * The flow adds units and leaves the price untouched. That single property is
 * what separates time-weighted return from simple return: paying money in
 * cannot itself move the unit price, so the price series reflects only what
 * the manager did with the money, not when you happened to add more.
 *
 * On a date carrying both a flow and a reading, the flow is applied first at
 * the PREVIOUS price (the brief says "strictly before d"), and the reading
 * then sets the new price against the increased unit count. Doing it the
 * other way round would credit the new money with that day's movement.
 *
 * ## Gaps
 *
 * Between readings the last known price is carried forward and the point is
 * flagged. It is never interpolated: a straight line drawn between two
 * readings asserts intermediate values that were never observed, which is
 * exactly the kind of smoothing this project exists to avoid.
 *
 * Which dates count as "between readings" is inferred rather than assumed. A
 * fixed weekly grid would break the moment a valuation date drifted by a day,
 * silently forward-filling everything and discarding every real reading. So
 * the cadence is derived from the readings themselves — the median interval
 * between them — and any interval materially longer than that is treated as a
 * gap and filled at that cadence. With genuinely weekly readings this
 * recovers exactly the missing weeks; with irregular ones it degrades to
 * "only fill what is clearly missing" rather than to nonsense.
 */
import { MICRO, unitPriceMicro, unitsForAmountMicro, valueFromUnits } from './money'
import { addDays, daysBetween, toEpochDay } from './dates'
import type { Flow, Reading, SeriesInput, SeriesPoint } from './types'

/** An interval longer than this multiple of the usual cadence is a gap. */
const GAP_THRESHOLD = 1.5

function medianInterval(sortedDates: string[]): number | null {
  if (sortedDates.length < 3) return null
  const gaps: number[] = []
  for (let i = 1; i < sortedDates.length; i++) {
    gaps.push(daysBetween(sortedDates[i - 1]!, sortedDates[i]!))
  }
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  const median =
    gaps.length % 2 === 0 ? Math.round((gaps[mid - 1]! + gaps[mid]!) / 2) : gaps[mid]!
  return median > 0 ? median : null
}

/**
 * The dates the series has a point for: every reading, every flow, and the
 * cadence-spaced dates inside any gap between readings.
 */
export function buildDateGrid(readings: Reading[], flows: Flow[]): string[] {
  const readingDates = readings.map((r) => r.valuationDate).sort()
  const dates = new Set<string>(readingDates)
  for (const flow of flows) dates.add(flow.effectiveDate)

  const cadence = medianInterval(readingDates)
  if (cadence) {
    for (let i = 1; i < readingDates.length; i++) {
      const from = readingDates[i - 1]!
      const to = readingDates[i]!
      if (daysBetween(from, to) <= cadence * GAP_THRESHOLD) continue
      for (let d = addDays(from, cadence); toEpochDay(d) < toEpochDay(to); d = addDays(d, cadence)) {
        dates.add(d)
      }
    }
  }

  return [...dates].sort()
}

export function buildSeries(input: SeriesInput): SeriesPoint[] {
  const { inceptionDate, initialPence } = input

  const readings = [...input.readings].sort((a, b) => a.valuationDate.localeCompare(b.valuationDate))
  const readingByDate = new Map(readings.map((r) => [r.valuationDate, r]))

  // The opening investment is already expressed by initialPence, so an
  // 'initial' flow describes the same money and must not be counted twice.
  // Anything dated at or before inception is likewise already in the seed.
  const flows = input.flows
    .filter((f) => f.kind !== 'initial' && daysBetween(inceptionDate, f.effectiveDate) > 0)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))

  const flowsByDate = new Map<string, number>()
  for (const flow of flows) {
    flowsByDate.set(flow.effectiveDate, (flowsByDate.get(flow.effectiveDate) ?? 0) + flow.amountPence)
  }

  // units(inception) = initial_pence, which makes the opening price exactly
  // 1.000000 by construction rather than by rounding.
  let unitsMicro = initialPence * MICRO
  let priceMicro = MICRO

  const points: SeriesPoint[] = [
    {
      onDate: inceptionDate,
      unitPriceMicro: priceMicro,
      unitsMicro,
      valuePence: initialPence,
      isOpening: true,
      isForwardFilled: false,
    },
  ]

  for (const onDate of buildDateGrid(readings, flows)) {
    if (daysBetween(inceptionDate, onDate) <= 0) continue

    // Flow first, at the price still standing from before this date.
    const flowAmount = flowsByDate.get(onDate)
    if (flowAmount !== undefined && flowAmount !== 0) {
      unitsMicro += unitsForAmountMicro(flowAmount, priceMicro)
    }

    const reading = readingByDate.get(onDate)
    if (reading) {
      priceMicro = unitPriceMicro(reading.valuePence, unitsMicro)
      points.push({
        onDate,
        unitPriceMicro: priceMicro,
        unitsMicro,
        valuePence: reading.valuePence,
        isOpening: false,
        isForwardFilled: false,
      })
    } else {
      points.push({
        onDate,
        unitPriceMicro: priceMicro,
        unitsMicro,
        valuePence: valueFromUnits(unitsMicro, priceMicro),
        isOpening: false,
        isForwardFilled: true,
      })
    }
  }

  return points
}

/** Net money in, up to and including a date — the denominator of simple return. */
export function netInvestedPence(input: SeriesInput, onDate?: string): number {
  const cutoff = onDate ? toEpochDay(onDate) : Infinity
  let total = input.initialPence
  for (const flow of input.flows) {
    if (flow.kind === 'initial') continue
    if (daysBetween(input.inceptionDate, flow.effectiveDate) <= 0) continue
    if (toEpochDay(flow.effectiveDate) > cutoff) continue
    total += flow.amountPence
  }
  return total
}
