/**
 * UK Statutory Maternity/Paternity Pay — simplified to one blended monthly
 * income figure for the whole paid leave period, not a week-by-week
 * schedule (this app's whole schedule model is calendar-year granularity;
 * see maternityLeave.ts). Not a full HMRC calculator: no NI/tax, no
 * Keeping-in-Touch days, no employer-enhanced schemes — just the statutory
 * floor, stated openly as a simplification.
 *
 * Real statutory maternity pay: 90% of average weekly earnings (AWE) for
 * the first 6 weeks, then the LOWER of the flat statutory rate or 90% AWE
 * for up to 33 more weeks (39 weeks paid total). Paternity pay uses the
 * same "lower of" rate for up to 2 weeks, with no higher-rate tier.
 */

/** The flat weekly rate for the "lower of 90% AWE or this" tier — HMRC's
 *  2024/25 rate (from April 2024). A real named, dated constant: HMRC
 *  republishes this every April, so it needs annual review, not a one-time
 *  entry. See gov.uk/statutory-maternity-pay. */
export const STATUTORY_WEEKLY_RATE = 184.03

export type LeaveType = 'maternity' | 'paternity'

const LEAVE_STRUCTURE: Record<LeaveType, { higherRateWeeks: number; lowerRateWeeks: number }> = {
  maternity: { higherRateWeeks: 6, lowerRateWeeks: 33 },
  paternity: { higherRateWeeks: 0, lowerRateWeeks: 2 },
}

export type StatutoryPayResult = {
  averageWeeklyEarnings: number
  higherRateWeeklyPay: number
  lowerRateWeeklyPay: number
  paidWeeks: number
  totalStatutoryPay: number
  blendedWeeklyPay: number
  blendedMonthlyPay: number
}

/**
 * Blends the two-tier weekly structure into one average weekly/monthly
 * figure across the whole statutory paid period — deliberately a single
 * "what does a typical month of leave look like" number, not a week-by-week
 * schedule, since maternityLeave.ts only ever needs one reduced-monthly
 * figure to hand to the existing contribution_changes primitive.
 */
export function calculateStatutoryPay(annualSalary: number, leaveType: LeaveType): StatutoryPayResult {
  const averageWeeklyEarnings = Math.max(0, annualSalary) / 52
  const { higherRateWeeks, lowerRateWeeks } = LEAVE_STRUCTURE[leaveType]
  const higherRateWeeklyPay = averageWeeklyEarnings * 0.9
  const lowerRateWeeklyPay = Math.min(STATUTORY_WEEKLY_RATE, averageWeeklyEarnings * 0.9)
  const paidWeeks = higherRateWeeks + lowerRateWeeks
  const totalStatutoryPay = higherRateWeeks * higherRateWeeklyPay + lowerRateWeeks * lowerRateWeeklyPay
  const blendedWeeklyPay = paidWeeks > 0 ? totalStatutoryPay / paidWeeks : 0

  return {
    averageWeeklyEarnings,
    higherRateWeeklyPay,
    lowerRateWeeklyPay,
    paidWeeks,
    totalStatutoryPay,
    blendedWeeklyPay,
    blendedMonthlyPay: (blendedWeeklyPay * 52) / 12,
  }
}
