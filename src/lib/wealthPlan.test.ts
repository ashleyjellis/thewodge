import { describe, expect, it } from 'vitest'
import { projectWealthPlan, type WealthPlanInput } from './wealthPlan'
import type { Assumptions } from './forecast'

const A: Assumptions = { investedRate: 0.07, cashRate: 0.02, targetAge: 60 }

const BASE: WealthPlanInput = {
  age: 40,
  targetAge: 60,
  salary: 0,
  pensionPct: 0,
  pension: 0,
  isaStocks: 0,
  isaCash: 0,
  cashSavings: 0,
  isaStocksMonthly: 0,
  isaCashMonthly: 0,
  cashSavingsMonthly: 0,
  bonus: 0,
  bonusTarget: 'isaStocks',
}

describe('projectWealthPlan (pure, nominal)', () => {
  it('projects a lump-only pension at the invested rate — matches forecast.ts numbers for the same inputs', () => {
    const r = projectWealthPlan({ ...BASE, pension: 100_000 }, A)
    expect(r.monthsToTarget).toBe(240)
    expect(r.pots.pension.future).toBeCloseTo(386_968.45, 1) // 100k × 1.07^20
    expect(r.pots.isaStocks.future).toBe(0)
    expect(r.pots.isaCash.future).toBe(0)
    expect(r.pots.cashSavings.future).toBe(0)
    expect(r.todayTotal).toBe(100_000)
    expect(r.projectedTotal).toBeCloseTo(386_968.45, 1)
    expect(r.marketAdds).toBeCloseTo(286_968.45, 1)
  })

  it('grows ISA cash and cash savings at the lower cash rate, never the invested rate', () => {
    const r = projectWealthPlan({ ...BASE, isaCash: 50_000, cashSavings: 50_000 }, A)
    expect(r.pots.isaCash.future).toBeCloseTo(74_297.37, 1) // 50k × 1.02^20
    expect(r.pots.cashSavings.future).toBeCloseTo(74_297.37, 1)
    expect(r.projectedTotal).toBeCloseTo(148_594.74, 1)
  })

  it('grows ISA stocks & shares at the invested rate', () => {
    const r = projectWealthPlan({ ...BASE, isaStocks: 100_000 }, A)
    expect(r.pots.isaStocks.future).toBeCloseTo(386_968.45, 1)
  })

  it('derives the pension monthly contribution from salary × pensionPct ÷ 12', () => {
    const r = projectWealthPlan({ ...BASE, salary: 60_000, pensionPct: 0.05 }, A)
    expect(r.pensionMonthly).toBe(250)
    expect(r.pots.pension.contributions).toBe(250 * 240)
  })

  it('adds each monthly contribution to its own pot only', () => {
    const r = projectWealthPlan(
      {
        ...BASE,
        isaStocksMonthly: 300,
        isaCashMonthly: 100,
        cashSavingsMonthly: 50,
      },
      A,
    )
    expect(r.pots.isaStocks.contributions).toBe(300 * 240)
    expect(r.pots.isaCash.contributions).toBe(100 * 240)
    expect(r.pots.cashSavings.contributions).toBe(50 * 240)
    expect(r.pots.pension.contributions).toBe(0)
    expect(r.totalContributions).toBe((300 + 100 + 50) * 240)
  })

  it('adds the bonus once a year, only to the chosen pot, and it earns no growth the year it lands', () => {
    const r = projectWealthPlan(
      { ...BASE, age: 58, targetAge: 60, bonus: 1_200, bonusTarget: 'cashSavings' },
      A,
    )
    // year 1: bonus lands, no prior balance to grow — endValue is exactly the bonus
    expect(r.yearly[1]!.pots.cashSavings.endValue).toBeCloseTo(1_200, 6)
    expect(r.yearly[1]!.pots.cashSavings.growth).toBeCloseTo(0, 6)
    // year 2: last year's bonus has now grown a full year at the cash rate, plus this year's bonus lands fresh
    expect(r.yearly[2]!.pots.cashSavings.endValue).toBeCloseTo(1_200 * 1.02 + 1_200, 1)
    expect(r.yearly[2]!.pots.cashSavings.growth).toBeCloseTo(1_200 * 0.02, 1)
    // it never touched any other pot
    expect(r.pots.pension.future).toBe(0)
    expect(r.pots.isaStocks.future).toBe(0)
    expect(r.pots.isaCash.future).toBe(0)
  })

  it('sums today, contributions and growth across all four pots into the whole-picture totals', () => {
    const r = projectWealthPlan(
      {
        ...BASE,
        salary: 50_000,
        pensionPct: 0.06,
        pension: 40_000,
        isaStocks: 20_000,
        isaCash: 10_000,
        cashSavings: 5_000,
        isaStocksMonthly: 200,
        isaCashMonthly: 50,
        cashSavingsMonthly: 50,
        bonus: 1_000,
        bonusTarget: 'isaStocks',
      },
      A,
    )
    const summedToday = r.pots.pension.today + r.pots.isaStocks.today + r.pots.isaCash.today + r.pots.cashSavings.today
    const summedFuture =
      r.pots.pension.future + r.pots.isaStocks.future + r.pots.isaCash.future + r.pots.cashSavings.future
    expect(r.todayTotal).toBe(summedToday)
    expect(r.projectedTotal).toBeCloseTo(summedFuture, 6)
    expect(r.whatYouPutIn + r.marketAdds).toBeCloseTo(r.projectedTotal, 6)

    // every yearly row's total is the sum of that row's four pots
    for (const row of r.yearly) {
      const rowSum =
        row.pots.pension.endValue +
        row.pots.isaStocks.endValue +
        row.pots.isaCash.endValue +
        row.pots.cashSavings.endValue
      expect(row.total.endValue).toBeCloseTo(rowSum, 6)
    }
    expect(r.yearly[r.yearly.length - 1]!.total.endValue).toBeCloseTo(r.projectedTotal, 6)
  })

  it('finds a crossover year when pots are large and contributions modest', () => {
    const r = projectWealthPlan(
      { ...BASE, pension: 200_000, isaStocks: 100_000, isaStocksMonthly: 50 },
      A,
    )
    expect(r.crossoverYear).not.toBeNull()
    expect(r.crossoverYear!).toBeGreaterThan(0)
  })

  it('never finds a crossover with nothing invested', () => {
    const r = projectWealthPlan(BASE, A)
    expect(r.crossoverYear).toBeNull()
    expect(r.projectedTotal).toBe(0)
  })

  it('handles age at/after target age — a single point, no growth', () => {
    const r = projectWealthPlan({ ...BASE, age: 60, targetAge: 60, pension: 50_000 }, A)
    expect(r.monthsToTarget).toBe(0)
    expect(r.yearly).toHaveLength(1)
    expect(r.projectedTotal).toBe(50_000)
    expect(r.marketAdds).toBe(0)

    const past = projectWealthPlan({ ...BASE, age: 62, targetAge: 60, pension: 10_000 }, A)
    expect(past.yearly).toHaveLength(1)
    expect(past.projectedTotal).toBe(10_000)
  })
})
