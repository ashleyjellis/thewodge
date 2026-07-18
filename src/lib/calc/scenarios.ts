/**
 * Scenarios (spec §3.6, §3.9, §3.10).
 *
 *  - stop-at-X        — freeze contributions at a chosen age, compound to retirement.
 *  - earliest FI      — first year the pot sustains target income at the SWR (or lower).
 *  - bridge check     — can investments ALONE fund the years between an early stop and
 *                       pension access age (57)? Green/red + the surplus/shortfall.
 *
 * Pure — no IO, no framework.
 */
import { annualContribution, PENSION_ACCESS_AGE, type Pot } from './types'
import { projectPot, type ProjectionPoint } from './projection'

// ── Stop-at-X ────────────────────────────────────────────────────────────────

export type StopScenario = {
  stopAge: number
  /** years from now that contributions stop */
  yearsUntilStop: number
  /** the pot's value at retirement after freezing contributions at stopAge */
  finalValue: number
  points: ProjectionPoint[]
}

/**
 * Project a pot to retirement, but freeze contributions once the person hits
 * `stopAge`. Contributions run for the years up to the stop, then the balance
 * simply compounds. If stopAge is at/after retirement it never freezes; if it's
 * at/before today the pot coasts from now.
 */
export function stopAtScenario(
  pot: Pot,
  r: number,
  currentAge: number,
  stopAge: number,
  retirementAge: number,
): StopScenario {
  const years = Math.max(0, retirementAge - currentAge)
  const yearsUntilStop = Math.max(0, Math.min(years, stopAge - currentAge))
  const base = annualContribution(pot)
  const points = projectPot(pot, r, years, {
    contributionForYear: (y) => (y <= yearsUntilStop ? base : 0),
  })
  return {
    stopAge,
    yearsUntilStop,
    finalValue: points[points.length - 1]!.endValue,
    points,
  }
}

// ── Earliest FI ────────────────────────────────────────────────────────────

export type EarliestFi = {
  /** years from now until the pot first sustains target income (null if never) */
  year: number | null
  /** age at that point (null if never within horizon) */
  age: number | null
  /** pot value at that point */
  value: number | null
}

/**
 * First year in a projection where the balance reaches the FI number — i.e. it
 * would sustain the target income at the SWR (or lower).
 */
export function earliestFiFromSeries(
  points: ProjectionPoint[],
  fi: number,
  currentAge?: number,
): EarliestFi {
  for (const p of points) {
    if (p.endValue >= fi) {
      return {
        year: p.year,
        age: currentAge !== undefined ? currentAge + p.year : null,
        value: p.endValue,
      }
    }
  }
  return { year: null, age: null, value: null }
}

/** Earliest FI for a single pot growing with its contributions. */
export function earliestFiAge(
  pot: Pot,
  r: number,
  fi: number,
  currentAge: number,
  horizon: number,
): EarliestFi {
  return earliestFiFromSeries(projectPot(pot, r, horizon), fi, currentAge)
}

// ── Bridge check ─────────────────────────────────────────────────────────────

export type BridgeCheck = {
  /** whether investments alone cover the bridge */
  covered: boolean
  /** number of years to bridge (stopAge → access age) */
  bridgeYears: number
  /** pot value available at the stop age */
  potAtStop: number
  /** pot needed at the stop age to exactly fund the bridge */
  requiredPot: number
  /** potAtStop − requiredPot, capped at 0 below */
  surplus: number
  /** requiredPot − potAtStop, capped at 0 below */
  shortfall: number
}

/**
 * Pot needed at the stop age to fund `bridgeYears` of `income` withdrawals, taken
 * at the start of each year, remainder growing at r (an annuity-due present value).
 */
export function requiredBridgePot(
  income: number,
  r: number,
  bridgeYears: number,
): number {
  if (bridgeYears <= 0) return 0
  if (r === 0) return income * bridgeYears
  return (income * (1 + r) * (1 - Math.pow(1 + r, -bridgeYears))) / r
}

/**
 * Does the investments pot ALONE cover target income from the stop age until
 * pension access age? This is the whole reason the pots are kept separate.
 */
export function bridgeCheck(
  potAtStop: number,
  income: number,
  stopAge: number,
  r: number,
  accessAge: number = PENSION_ACCESS_AGE,
): BridgeCheck {
  const bridgeYears = Math.max(0, accessAge - stopAge)
  const requiredPot = requiredBridgePot(income, r, bridgeYears)
  const diff = potAtStop - requiredPot
  return {
    covered: potAtStop >= requiredPot,
    bridgeYears,
    potAtStop,
    requiredPot,
    surplus: Math.max(0, diff),
    shortfall: Math.max(0, -diff),
  }
}
