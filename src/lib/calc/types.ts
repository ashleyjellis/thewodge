/**
 * The Wodge — core data model (spec §2).
 *
 * Keep pots SEPARATE — this separation is the core insight, not a UI detail.
 * Pension (locked, tax-efficient, autopilot), investments (the bridge + accessible
 * wealth), cash (ring-fenced, a different job). All figures are in today's money
 * (real terms). This module is pure types + defaults — zero IO, zero framework.
 */

export type Assumptions = {
  /** invested assets, real terms. default 0.07 */
  realReturn: number
  /** cash / cash ISA, real terms. default 0.045 */
  cashReturn: number
  /** safe withdrawal rate. default 0.04 */
  swr: number
}

export type EmployerPension = {
  /** employee's own contribution, e.g. 0.06 */
  userPct: number
  /** employer match, e.g. 0.06 */
  matchPct: number
  /** additional employer contribution, e.g. 0.06 */
  additionalPct: number
}

export type Pot = {
  /** current balance */
  value: number
  /** monthly contribution (pension = incl. employer) */
  monthly: number
  /** e.g. bonus deployed once a year (0 if none) */
  annualLump: number
}

export type CashPot = Pot & {
  /** emergency fund — excluded from investable / compounding */
  ringFenced: boolean
  /** earmarked for a goal (e.g. house deposit) vs pure buffer */
  goalEarmark: boolean
}

export type Person = {
  name: string
  age: number
  /** base — needed for £100k-trap + tax-relief framing */
  salary: number
  /** typical annual bonus */
  bonus: number
  employerPension: EmployerPension
  pension: Pot
  /** stocks & shares ISA / GIA */
  stocks: Pot
  cash: CashPot
}

export type Household = {
  people: [Person] | [Person, Person]
  /** default 58 — sidesteps pension access age (55→57 in 2028) */
  retirementAge: number
  /** the FI anchor, today's money */
  targetIncomeToday: number
  assumptions: Assumptions
}

export type SnapshotType = 'baseline' | 'actual'

export type Snapshot = {
  id: string
  /** ISO timestamp */
  timestamp: string
  type: SnapshotType
  /** immutable deep copy */
  state: Household
  /** freeform — "bonus invested", "pulled £5k for wedding", etc. */
  note: string
}

/** The three investable pot kinds a person holds. */
export type PotKind = 'pension' | 'stocks' | 'cash'

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  realReturn: 0.07,
  cashReturn: 0.045,
  swr: 0.04,
}

/** Pension access age used for the bridge check (55 → 57 in 2028). */
export const PENSION_ACCESS_AGE = 57

/** Default retirement age — sidesteps the moving pension access age. */
export const DEFAULT_RETIREMENT_AGE = 58

/** Annual contribution into a pot = twelve monthly payments plus any annual lump. */
export function annualContribution(pot: Pot): number {
  return pot.monthly * 12 + pot.annualLump
}
