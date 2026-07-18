/**
 * Lifetime value of £1 (spec §3.7) and total deployed vs market-generated (§3.8).
 *
 *  - value of £1 by year — (1+r)^(horizon − yearSaved). Powers "£10 today is worth
 *    £18 at 40". Frame both ways: the value of saving / the cost of spending — the
 *    same number, a different label.
 *  - deployed vs generated — everything you put in vs everything the market added.
 *    "You put in £X; the market gave you £Y free."
 *
 * Pure — no IO, no framework.
 */

/**
 * Future value of a one-off amount compounding for `years` at real return `r`.
 * e.g. futureValueOfAmount(10, 0.07, 9) ≈ 18.38  ("£10 today ≈ £18 at 40").
 */
export function futureValueOfAmount(
  amount: number,
  r: number,
  years: number,
): number {
  return amount * Math.pow(1 + r, years)
}

export type LifetimeValuePoint = {
  /** the age at which the amount is saved */
  age: number
  /** years left to compound until the horizon */
  yearsToHorizon: number
  /** the value that saving reaches at the horizon */
  valueAtHorizon: number
  /** multiple of the original amount */
  multiple: number
}

/**
 * For an amount saved at each age from `currentAge` to `horizonAge`, its value at
 * the horizon. Saving earlier is worth more — the whole point of the view.
 */
export function lifetimeValueByYear(
  amount: number,
  r: number,
  currentAge: number,
  horizonAge: number,
): LifetimeValuePoint[] {
  const points: LifetimeValuePoint[] = []
  for (let age = currentAge; age <= horizonAge; age++) {
    const yearsToHorizon = horizonAge - age
    const valueAtHorizon = futureValueOfAmount(amount, r, yearsToHorizon)
    points.push({
      age,
      yearsToHorizon,
      valueAtHorizon,
      multiple: amount !== 0 ? valueAtHorizon / amount : 0,
    })
  }
  return points
}

export type DeployedVsGenerated = {
  /** everything the household actually contributed (excludes starting balances) */
  deployed: number
  /** everything the market added */
  generated: number
  /** final pot value */
  finalValue: number
  /** generated ÷ deployed — "£1 in became £N" */
  multiple: number
}

/**
 * Split a final pot into what was deployed (contributed) vs what the market
 * generated. `startingValue` is any balance already held today, which is neither
 * newly deployed nor generated over the horizon.
 */
export function deployedVsGenerated(
  finalValue: number,
  totalDeployed: number,
  startingValue = 0,
): DeployedVsGenerated {
  const generated = finalValue - totalDeployed - startingValue
  return {
    deployed: totalDeployed,
    generated,
    finalValue,
    multiple: totalDeployed !== 0 ? generated / totalDeployed : 0,
  }
}
