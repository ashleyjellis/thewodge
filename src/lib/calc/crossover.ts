/**
 * Crossover year (spec §3.5).
 *
 * The first year in which annual MARKET GROWTH exceeds annual CONTRIBUTIONS —
 * the moment the machine starts doing more than you do. Per pot and combined.
 *
 * Pure — no IO, no framework.
 */
import { projectPot, type ProjectionPoint } from './projection'
import type { Pot } from './types'

export type Crossover = {
  /** years from now the crossover happens (null if it never does in-horizon) */
  year: number | null
  /** calendar year of the crossover, when a base year is supplied */
  calendarYear: number | null
  /** the contribution and growth in the crossover year */
  contributionAtCrossover: number | null
  growthAtCrossover: number | null
}

/**
 * Find the first year (>= 1) where growth > contribution in a projection series.
 */
export function crossoverFromSeries(
  points: ProjectionPoint[],
  baseYear?: number,
): Crossover {
  for (const p of points) {
    if (p.year >= 1 && p.growth > p.contribution) {
      return {
        year: p.year,
        calendarYear: baseYear !== undefined ? baseYear + p.year : null,
        contributionAtCrossover: p.contribution,
        growthAtCrossover: p.growth,
      }
    }
  }
  return {
    year: null,
    calendarYear: null,
    contributionAtCrossover: null,
    growthAtCrossover: null,
  }
}

/** Crossover year for a single pot. */
export function crossoverYear(
  pot: Pot,
  r: number,
  years: number,
  baseYear?: number,
): Crossover {
  return crossoverFromSeries(projectPot(pot, r, years), baseYear)
}
