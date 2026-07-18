/**
 * A realistic sample household — the app's default seed and the composition-layer
 * test fixture (one source of truth). Audience: a household on ~£150k+ combined,
 * feeling wealthy on paper but not in reality. Target income anchors FI at £1.75m.
 *
 * Data only — pure, no IO.
 */
import { DEFAULT_ASSUMPTIONS, type Household, type Person } from './calc/types'

const sam: Person = {
  name: 'Sam',
  age: 36,
  salary: 88_000,
  bonus: 12_000,
  employerPension: { userPct: 0.05, matchPct: 0.05, additionalPct: 0.03 },
  pension: { value: 145_000, monthly: 1_200, annualLump: 0 },
  stocks: { value: 76_000, monthly: 900, annualLump: 8_000 },
  cash: {
    value: 32_000,
    monthly: 150,
    annualLump: 0,
    ringFenced: true,
    goalEarmark: false,
  },
}

const alex: Person = {
  name: 'Alex',
  age: 34,
  salary: 72_000,
  bonus: 6_000,
  employerPension: { userPct: 0.04, matchPct: 0.04, additionalPct: 0.02 },
  pension: { value: 98_000, monthly: 850, annualLump: 0 },
  stocks: { value: 41_000, monthly: 500, annualLump: 4_000 },
  cash: {
    value: 18_000,
    monthly: 100,
    annualLump: 0,
    ringFenced: false,
    goalEarmark: true,
  },
}

export const SAMPLE_HOUSEHOLD: Household = {
  people: [sam, alex],
  retirementAge: 58,
  targetIncomeToday: 70_000,
  assumptions: { ...DEFAULT_ASSUMPTIONS },
}

/** A single-person starter, e.g. straight after the landing hook. */
export function starterHousehold(age: number, totalInvested: number): Household {
  // split a single "total invested" figure across pension and stocks (rough,
  // editable) — cash starts as a small ring-fenced buffer.
  const pensionValue = Math.round(totalInvested * 0.6)
  const stocksValue = totalInvested - pensionValue
  const person: Person = {
    name: 'You',
    age,
    salary: 75_000,
    bonus: 0,
    employerPension: { userPct: 0.05, matchPct: 0.05, additionalPct: 0 },
    pension: { value: pensionValue, monthly: 800, annualLump: 0 },
    stocks: { value: stocksValue, monthly: 500, annualLump: 0 },
    cash: {
      value: 0,
      monthly: 0,
      annualLump: 0,
      ringFenced: true,
      goalEarmark: false,
    },
  }
  return {
    people: [person],
    retirementAge: 58,
    targetIncomeToday: 40_000,
    assumptions: { ...DEFAULT_ASSUMPTIONS },
  }
}
