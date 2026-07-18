/**
 * Education helpers (spec §3, §9) — pure, public-information, zero advice.
 *
 * These explain publicly-derivable mechanics: the £100k personal-allowance trap
 * and the value of an employer's pension contribution. They state no opinion and
 * name no product.
 *
 * Tax figures are England/Wales/NI, 2025/26 — publicly published by HMRC. The
 * personal allowance (£12,570), the £100,000 taper start and the £125,140 taper
 * end are frozen for 2025/26. Date and source these in the UI.
 */
import type { EmployerPension } from './types'

/** Standard personal allowance (2025/26). */
export const PERSONAL_ALLOWANCE = 12570
/** Income at which the personal allowance starts to taper. */
export const PA_TAPER_START = 100000
/** Income at which the personal allowance is fully withdrawn. */
export const PA_TAPER_END = 125140
/** Effective marginal rate inside the taper band (40% + the tapered allowance). */
export const PA_TRAP_MARGINAL_RATE = 0.6

export type PersonalAllowanceTrap = {
  /** salary + bonus − pension sacrifice */
  adjustedNetIncome: number
  /** income sits in the £100k–£125,140 band */
  inTrap: boolean
  /** personal allowance withdrawn by the taper (£1 per £2 over £100k) */
  personalAllowanceLost: number
  /** how much of the income lies inside the taper band */
  amountInBand: number
  /** the effective marginal rate that applies to income in the band (~60%) */
  effectiveMarginalRate: number
  /** pension sacrifice that would bring income back to £100k (0 if already below) */
  sacrificeToClear: number
  bandLower: number
  bandUpper: number
}

/**
 * Whether taxable income sits in the £100k–£125,140 band and the ~60% effective
 * marginal rate there. `pensionSacrifice` reduces adjusted net income £-for-£.
 */
export function personalAllowanceTrap(
  salary: number,
  bonus: number,
  pensionSacrifice: number,
): PersonalAllowanceTrap {
  const adjustedNetIncome = salary + bonus - pensionSacrifice
  const inTrap =
    adjustedNetIncome > PA_TAPER_START && adjustedNetIncome <= PA_TAPER_END
  const personalAllowanceLost = clamp(
    (adjustedNetIncome - PA_TAPER_START) / 2,
    0,
    PERSONAL_ALLOWANCE,
  )
  const amountInBand = clamp(
    Math.min(adjustedNetIncome, PA_TAPER_END) - PA_TAPER_START,
    0,
    PA_TAPER_END - PA_TAPER_START,
  )
  return {
    adjustedNetIncome,
    inTrap,
    personalAllowanceLost,
    amountInBand,
    effectiveMarginalRate: inTrap ? PA_TRAP_MARGINAL_RATE : 0,
    sacrificeToClear: Math.max(0, adjustedNetIncome - PA_TAPER_START),
    bandLower: PA_TAPER_START,
    bandUpper: PA_TAPER_END,
  }
}

export type EmployerMatch = {
  /** the match the employer adds when you contribute (the "free money") */
  matchAnnual: number
  /** any additional employer contribution */
  additionalAnnual: number
  /** total employer contribution per year */
  employerAnnual: number
  /** the employee's own contribution per year */
  employeeAnnual: number
  /** everything going into the pension per year */
  totalAnnual: number
}

/**
 * Annual £ of employer pension contribution — the match plus any additional
 * employer top-up, framed as "free money" you'd forgo by not contributing.
 */
export function employerMatchValue(
  salary: number,
  employerPension: EmployerPension,
): EmployerMatch {
  const matchAnnual = salary * employerPension.matchPct
  const additionalAnnual = salary * employerPension.additionalPct
  const employeeAnnual = salary * employerPension.userPct
  return {
    matchAnnual,
    additionalAnnual,
    employerAnnual: matchAnnual + additionalAnnual,
    employeeAnnual,
    totalAnnual: employeeAnnual + matchAnnual + additionalAnnual,
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
