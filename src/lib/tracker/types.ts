/**
 * Shared shapes for the tracker engine.
 *
 * Everything here is a plain value type. The engine takes arrays in and
 * returns arrays out, with no database imports anywhere in src/lib/tracker —
 * it is the part that has to be right, so it is the part that must be
 * testable without a database, a server or a browser.
 */
import type { FlowKind } from '@/server/trackerDb/schema'

export type Reading = {
  /** the date the PROVIDER says the value is as of */
  valuationDate: string
  valuePence: number
}

export type Flow = {
  effectiveDate: string
  /** negative for a withdrawal */
  amountPence: number
  kind: FlowKind
}

export type SeriesPoint = {
  onDate: string
  unitPriceMicro: number
  unitsMicro: number
  valuePence: number
  /**
   * True when no reading exists for this date and the last known unit price
   * was carried forward. Never an interpolation — the value is what the
   * previous reading implies, not a guess at what happened in between.
   */
  isForwardFilled: boolean
}

export type SeriesInput = {
  inceptionDate: string
  initialPence: number
  readings: Reading[]
  flows: Flow[]
}
