/**
 * Search params for /wealth-planning-tool — stateless like the free calculator
 * (see search.ts): every input lives in the URL, nothing is saved or sent, and the
 * page is shareable/bookmarkable as-is. A separate type from CalculatorSearch
 * because this tool asks for four named pots (not three) plus a salary-based
 * pension percentage and a bonus — genuinely different shape, not an extension.
 */
import { TARGET_AGE } from '../config'
import type { PotKey, WealthPlanInput } from './wealthPlan'
import { POT_KEYS } from './wealthPlan'

export type WealthPlanSearch = {
  age?: number
  targetAge?: number
  salary?: number
  /** whole percent, e.g. 5 for 5% — converted to a fraction in toWealthPlanInput */
  pensionPct?: number
  pension?: number
  isaStocks?: number
  isaCash?: number
  cashSavings?: number
  isaStocksMonthly?: number
  isaCashMonthly?: number
  cashSavingsMonthly?: number
  bonus?: number
  bonusTarget?: PotKey
}

const NON_NEGATIVE = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

const POT_KEY_SET = new Set<string>(POT_KEYS)
const asPotKey = (v: unknown): PotKey | undefined =>
  typeof v === 'string' && POT_KEY_SET.has(v) ? (v as PotKey) : undefined

/** validateSearch for the route — coerces and bounds the params. */
export function validateWealthPlanSearch(
  search: Record<string, unknown>,
): WealthPlanSearch {
  const age = NON_NEGATIVE(search.age)
  const targetAge = NON_NEGATIVE(search.targetAge)
  return {
    age: age !== undefined ? Math.min(age, 120) : undefined,
    targetAge: targetAge !== undefined ? Math.min(targetAge, 120) : undefined,
    salary: NON_NEGATIVE(search.salary),
    pensionPct: NON_NEGATIVE(search.pensionPct),
    pension: NON_NEGATIVE(search.pension),
    isaStocks: NON_NEGATIVE(search.isaStocks),
    isaCash: NON_NEGATIVE(search.isaCash),
    cashSavings: NON_NEGATIVE(search.cashSavings),
    isaStocksMonthly: NON_NEGATIVE(search.isaStocksMonthly),
    isaCashMonthly: NON_NEGATIVE(search.isaCashMonthly),
    cashSavingsMonthly: NON_NEGATIVE(search.cashSavingsMonthly),
    bonus: NON_NEGATIVE(search.bonus),
    bonusTarget: asPotKey(search.bonusTarget),
  }
}

/** Whether we have enough to draw a plan: an age, plus something to grow. */
export function canPlan(s: WealthPlanSearch): boolean {
  const hasAge = s.age !== undefined && s.age > 0 && s.age < 120
  const hasSomething =
    (s.pension ?? 0) +
      (s.isaStocks ?? 0) +
      (s.isaCash ?? 0) +
      (s.cashSavings ?? 0) +
      (s.isaStocksMonthly ?? 0) +
      (s.isaCashMonthly ?? 0) +
      (s.cashSavingsMonthly ?? 0) +
      ((s.salary ?? 0) > 0 && (s.pensionPct ?? 0) > 0 ? 1 : 0) >
    0
  return hasAge && hasSomething
}

export function toWealthPlanInput(s: WealthPlanSearch): WealthPlanInput {
  return {
    age: s.age ?? 0,
    targetAge: s.targetAge ?? TARGET_AGE,
    salary: s.salary ?? 0,
    pensionPct: (s.pensionPct ?? 0) / 100,
    pension: s.pension ?? 0,
    isaStocks: s.isaStocks ?? 0,
    isaCash: s.isaCash ?? 0,
    cashSavings: s.cashSavings ?? 0,
    isaStocksMonthly: s.isaStocksMonthly ?? 0,
    isaCashMonthly: s.isaCashMonthly ?? 0,
    cashSavingsMonthly: s.cashSavingsMonthly ?? 0,
    bonus: s.bonus ?? 0,
    bonusTarget: s.bonusTarget ?? 'isaStocks',
  }
}

const NUMERIC_KEYS = [
  'age',
  'targetAge',
  'salary',
  'pensionPct',
  'pension',
  'isaStocks',
  'isaCash',
  'cashSavings',
  'isaStocksMonthly',
  'isaCashMonthly',
  'cashSavingsMonthly',
  'bonus',
] as const

/** Drop empty values so the URL stays clean. */
export function toWealthPlanSearch(s: WealthPlanSearch): WealthPlanSearch {
  const out: WealthPlanSearch = {}
  for (const k of NUMERIC_KEYS) {
    const v = s[k]
    if (v !== undefined && v !== null && !Number.isNaN(v)) out[k] = v
  }
  if (s.bonusTarget !== undefined) out.bonusTarget = s.bonusTarget
  return out
}
