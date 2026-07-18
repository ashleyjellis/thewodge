/**
 * FI number and Coast FI (spec §3.1, §3.2).
 *
 * FI number    — the pot that sustains your target income forever at the SWR.
 * Coast FI     — the amount you'd need TODAY that, left completely untouched,
 *                compounds up to the FI number by retirement. Pension-only Coast
 *                FI is the insight that matters most, so it is first-class here.
 *
 * All real-terms. Pure functions — no IO, no framework.
 */
import { annualContribution, type Pot } from './types'

/**
 * FI number = target income (today's money) ÷ safe withdrawal rate.
 * e.g. £70,000 / 0.04 = £1,750,000.
 */
export function fiNumber(targetIncomeToday: number, swr: number): number {
  if (swr <= 0) throw new Error('swr must be > 0')
  return targetIncomeToday / swr
}

/**
 * Years from now until retirement. Never negative.
 */
export function yearsToRetirement(age: number, retirementAge: number): number {
  return Math.max(0, retirementAge - age)
}

/**
 * Coast FI number = FI discounted back over the years to retirement at the real
 * return. It's the balance that, with ZERO further contributions, grows into the
 * FI number by retirement.
 *
 *   coast = FI / (1 + r)^years
 *
 * e.g. £1,750,000 / 1.07^24 ≈ £345,000.
 *
 * Note: the spec quotes "≈ £432,000" for 24 years, but that figure is the discount
 * at 6% (£1,750,000 / 1.06^24 ≈ £432,200), not 7% — the spec's worked example pairs
 * the number with the wrong rate. The formula here is the source of truth; the tests
 * pin both cases so the arithmetic is unambiguous.
 */
export function coastFiNumber(
  fi: number,
  realReturn: number,
  years: number,
): number {
  return fi / Math.pow(1 + realReturn, years)
}

export type CoastFiStatus = {
  /** the amount needed today to coast */
  coastNumber: number
  /** the pot's current value */
  currentValue: number
  /** true when the pot already clears the coast number — self-sustaining */
  coasting: boolean
  /** currentValue − coastNumber. positive = surplus, negative = gap */
  surplus: number
  /** 0..1 how far the current value is toward the coast number */
  progress: number
  /**
   * Years until this pot (growing WITH its contributions) crosses the coast
   * threshold for the then-remaining horizon. 0 if already coasting, null if it
   * never crosses within the horizon.
   */
  yearsToCoast: number | null
}

/**
 * Coast FI status for a single pot against a target FI number.
 *
 * `yearsToCoast` simulates the pot forward with its contributions. As years pass
 * the remaining horizon shrinks, so the coast threshold RISES (less time to
 * compound); we return the first year the growing pot overtakes that rising bar.
 */
export function coastFiStatus(
  pot: Pot,
  fi: number,
  realReturn: number,
  years: number,
): CoastFiStatus {
  const coastNumber = coastFiNumber(fi, realReturn, years)
  const currentValue = pot.value
  const surplus = currentValue - coastNumber
  const coasting = currentValue >= coastNumber
  const progress = coastNumber > 0 ? clamp01(currentValue / coastNumber) : 1

  let yearsToCoast: number | null = coasting ? 0 : null
  if (!coasting) {
    const contribution = annualContribution(pot)
    let value = currentValue
    for (let y = 1; y <= years; y++) {
      value = (value + contribution) * (1 + realReturn)
      const remaining = years - y
      const coastThatYear = coastFiNumber(fi, realReturn, remaining)
      if (value >= coastThatYear) {
        yearsToCoast = y
        break
      }
    }
  }

  return { coastNumber, currentValue, coasting, surplus, progress, yearsToCoast }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
