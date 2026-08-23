/**
 * How often it falls, as distinct from how far.
 *
 * The drawdown callout answers "what was the worst of it". This answers "how
 * ordinary is a bad week", and the two are opposite kinds of reassurance for
 * opposite kinds of reader. Someone frightened of losing money is usually not
 * frightened of the single worst week — they are frightened that a fall means
 * something has gone wrong. Publishing that roughly two weeks in five are
 * down, in a portfolio that is up over the run, says more than any amount of
 * copy about staying invested.
 *
 * Deliberately not a risk score, a rating, or anything that could be read as
 * timing. It counts weeks.
 */
import type { SeriesPoint } from './types.js'

/**
 * Weeks below this many observed moves are not summarised.
 *
 * Twelve is not a statistical threshold — it is roughly a quarter, and it is
 * the point below which "60% of weeks were down" is three weeks out of five
 * and reads as a finding rather than as noise. The same principle as the
 * volatility gate: a proportion computed from a handful of observations is
 * arithmetic, not evidence.
 */
export const MIN_WEEKS_FOR_FREQUENCY = 12

/** A weekly move counts as a fall beyond this. */
export const SHARP_FALL_THRESHOLD = 0.02

export type LossFrequency = {
  /** null when there is not enough of a run to summarise */
  weeksUp: number | null
  weeksDown: number | null
  weeksFlat: number | null
  observedWeeks: number
  /** longest unbroken run of down weeks */
  longestDownRun: number | null
  /** weeks that fell more than SHARP_FALL_THRESHOLD */
  sharpFalls: number | null
  /** sharpFalls as a fraction of observed weeks */
  sharpFallShare: number | null
  isSufficient: boolean
}

/**
 * Counts weekly moves.
 *
 * Forward-filled points are excluded. A week nobody took a reading in did not
 * observably go up or down, and counting its carried-forward price as a flat
 * week would quietly claim stability that was never seen — the same reason
 * the series draws those stretches differently rather than smoothing them.
 */
export function analyseLossFrequency(points: SeriesPoint[]): LossFrequency {
  const moves: number[] = []

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!
    const current = points[i]!
    if (current.isForwardFilled || previous.unitPriceMicro <= 0) continue
    moves.push(current.unitPriceMicro / previous.unitPriceMicro - 1)
  }

  const observedWeeks = moves.length
  if (observedWeeks < MIN_WEEKS_FOR_FREQUENCY) {
    return {
      weeksUp: null,
      weeksDown: null,
      weeksFlat: null,
      observedWeeks,
      longestDownRun: null,
      sharpFalls: null,
      sharpFallShare: null,
      isSufficient: false,
    }
  }

  let weeksUp = 0
  let weeksDown = 0
  let weeksFlat = 0
  let sharpFalls = 0
  let longestDownRun = 0
  let currentDownRun = 0

  for (const move of moves) {
    if (move > 0) {
      weeksUp++
      currentDownRun = 0
    } else if (move < 0) {
      weeksDown++
      currentDownRun++
      longestDownRun = Math.max(longestDownRun, currentDownRun)
      if (move < -SHARP_FALL_THRESHOLD) sharpFalls++
    } else {
      // Exactly unchanged. Rare with a six-decimal unit price, but it is
      // neither a rise nor a fall and counting it as either would be a small
      // lie in whichever direction happened to be convenient.
      weeksFlat++
      currentDownRun = 0
    }
  }

  return {
    weeksUp,
    weeksDown,
    weeksFlat,
    observedWeeks,
    longestDownRun,
    sharpFalls,
    sharpFallShare: sharpFalls / observedWeeks,
    isSufficient: true,
  }
}
