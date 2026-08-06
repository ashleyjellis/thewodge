/**
 * "Does the investments pot alone cover the gap to pension access age?" —
 * a point-in-time adequacy comparison
 * (investmentsValue >= targetIncomeToday / swr), not a year-by-year
 * drawdown simulation. If the pot sustains the target income INDEFINITELY
 * at the given safe withdrawal rate, it trivially covers any shorter
 * bridge window too — a full depletion simulation (which could show the
 * pot needs LESS than this "forever" figure) is a deliberately deferred
 * refinement, not built here.
 *
 * Investments only — never pension (locked until its own access age, which
 * is the whole reason a bridge is needed) and never cash (a separate job,
 * per this app's five-slice taxonomy).
 */
export type BridgeCheckResult = {
  covers: boolean
  investmentsValue: number | null
  requiredValue: number
}

export function checkBridge(params: {
  investmentsValue: number | null
  targetIncomeToday: number
  swr: number
}): BridgeCheckResult {
  const requiredValue = params.swr > 0 ? params.targetIncomeToday / params.swr : Infinity
  return {
    covers: params.investmentsValue !== null && params.investmentsValue >= requiredValue,
    investmentsValue: params.investmentsValue,
    requiredValue,
  }
}
