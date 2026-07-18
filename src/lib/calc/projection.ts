/**
 * Year-by-year projection + contribution-vs-market-growth split (spec §3.3, §3.4).
 *
 * The recurrence is the one stated in the spec:
 *
 *   next = (prev + annualContribution) * (1 + r)
 *
 * i.e. the year's contribution goes in, then the whole balance grows one year.
 * Growth for a year is therefore (prev + contribution) * r.
 *
 * The contribution-vs-growth split — for each year, how much of the increase was
 * the user's money vs the market's — is "the single most powerful view".
 *
 * All real-terms. Pure — no IO, no framework.
 */
import { annualContribution, type Pot } from './types'

export type ProjectionPoint = {
  /** years from now (0 = today) */
  year: number
  /** value at the start of the year */
  startValue: number
  /** contribution added during the year */
  contribution: number
  /** market growth during the year */
  growth: number
  /** value at the end of the year */
  endValue: number
  /** total contributed since now (excludes the starting balance) */
  cumulativeContribution: number
  /** total market growth since now */
  cumulativeGrowth: number
  /** share of THIS year's increase that was contribution (0..1) */
  contributionShare: number
  /** share of THIS year's increase that was market growth (0..1) */
  growthShare: number
}

export type ProjectionOptions = {
  /**
   * Override the contribution for a given future year (1-indexed). Used by the
   * stop-at-X scenario to freeze contributions from a chosen age. Defaults to the
   * pot's constant annual contribution.
   */
  contributionForYear?: (year: number) => number
}

/**
 * Project a single pot forward `years` years at real return `r`.
 * Returns years+1 points; index 0 is today.
 *
 * Invariant: endValue = startingValue + cumulativeContribution + cumulativeGrowth.
 */
export function projectPot(
  pot: Pot,
  r: number,
  years: number,
  options: ProjectionOptions = {},
): ProjectionPoint[] {
  const baseContribution = annualContribution(pot)
  const contributionForYear =
    options.contributionForYear ?? (() => baseContribution)

  const points: ProjectionPoint[] = [
    {
      year: 0,
      startValue: pot.value,
      contribution: 0,
      growth: 0,
      endValue: pot.value,
      cumulativeContribution: 0,
      cumulativeGrowth: 0,
      contributionShare: 0,
      growthShare: 0,
    },
  ]

  for (let y = 1; y <= years; y++) {
    const prev = points[y - 1]!
    const startValue = prev.endValue
    const contribution = contributionForYear(y)
    const endValue = (startValue + contribution) * (1 + r)
    const growth = endValue - startValue - contribution
    const increase = contribution + growth
    const contributionShare = increase !== 0 ? contribution / increase : 0
    points.push({
      year: y,
      startValue,
      contribution,
      growth,
      endValue,
      cumulativeContribution: prev.cumulativeContribution + contribution,
      cumulativeGrowth: prev.cumulativeGrowth + growth,
      contributionShare,
      growthShare: increase !== 0 ? growth / increase : 0,
    })
  }

  return points
}

/** Final balance after projecting a pot forward. */
export function projectedValue(
  pot: Pot,
  r: number,
  years: number,
  options: ProjectionOptions = {},
): number {
  const points = projectPot(pot, r, years, options)
  return points[points.length - 1]!.endValue
}

/**
 * Sum several pot projections into one combined series, year by year.
 * All series must share the same length (same horizon).
 */
export function combineProjections(
  series: ProjectionPoint[][],
): ProjectionPoint[] {
  if (series.length === 0) return []
  const length = series[0]!.length
  const combined: ProjectionPoint[] = []

  for (let i = 0; i < length; i++) {
    let startValue = 0
    let contribution = 0
    let growth = 0
    let endValue = 0
    let cumulativeContribution = 0
    let cumulativeGrowth = 0
    for (const s of series) {
      const p = s[i]!
      startValue += p.startValue
      contribution += p.contribution
      growth += p.growth
      endValue += p.endValue
      cumulativeContribution += p.cumulativeContribution
      cumulativeGrowth += p.cumulativeGrowth
    }
    const increase = contribution + growth
    combined.push({
      year: i,
      startValue,
      contribution,
      growth,
      endValue,
      cumulativeContribution,
      cumulativeGrowth,
      contributionShare: increase !== 0 ? contribution / increase : 0,
      growthShare: increase !== 0 ? growth / increase : 0,
    })
  }

  return combined
}
