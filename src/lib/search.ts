/**
 * Calculator search params — the calculator is stateless; its inputs live in the
 * URL so guide/doorway pages can deep-link with pre-filled values that survive
 * navigation to /results. No signup, no storage.
 */
import type { ForecastInput } from './forecast'

export type CalculatorSearch = {
  age?: number
  pension?: number
  stocks?: number
  cash?: number
  monthly?: number
  /** manual monthly pension contribution — optional, results-page only */
  pensionMonthly?: number
  /** annual income (salary) — optional, results-page only */
  income?: number
}

const NON_NEGATIVE = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** validateSearch for the routes — coerces and bounds the params. */
export function validateCalculatorSearch(
  search: Record<string, unknown>,
): CalculatorSearch {
  const age = NON_NEGATIVE(search.age)
  return {
    age: age !== undefined ? Math.min(age, 120) : undefined,
    pension: NON_NEGATIVE(search.pension),
    stocks: NON_NEGATIVE(search.stocks),
    cash: NON_NEGATIVE(search.cash),
    monthly: NON_NEGATIVE(search.monthly),
    pensionMonthly: NON_NEGATIVE(search.pensionMonthly),
    income: NON_NEGATIVE(search.income),
  }
}

/** Whether we have enough to draw a forecast (age plus something to grow). */
export function canForecast(s: CalculatorSearch): boolean {
  const hasAge = s.age !== undefined && s.age > 0 && s.age < 120
  const hasSomething =
    (s.pension ?? 0) + (s.stocks ?? 0) + (s.cash ?? 0) + (s.monthly ?? 0) > 0
  return hasAge && hasSomething
}

export function toForecastInput(s: CalculatorSearch): ForecastInput {
  return {
    age: s.age ?? 0,
    pension: s.pension ?? 0,
    stocks: s.stocks ?? 0,
    cash: s.cash ?? 0,
    monthly: s.monthly ?? 0,
    pensionMonthly: s.pensionMonthly,
    income: s.income,
  }
}

/** Drop empty values so the URL stays clean. */
export function toSearch(s: CalculatorSearch): CalculatorSearch {
  const out: CalculatorSearch = {}
  for (const k of [
    'age',
    'pension',
    'stocks',
    'cash',
    'monthly',
    'pensionMonthly',
    'income',
  ] as const) {
    const v = s[k]
    if (v !== undefined && v !== null && !Number.isNaN(v)) out[k] = v
  }
  return out
}
