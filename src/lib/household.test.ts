import { describe, expect, it } from 'vitest'
import { aggregateHousehold, type Person } from './household'
import { projectWealthPlan } from './wealthPlan'
import type { Assumptions } from './forecast'

const A: Assumptions = { investedRate: 0.07, cashRate: 0.02, targetAge: 60 }

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    name: 'You',
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
    ...overrides,
  }
}

describe('aggregateHousehold', () => {
  it('one person: the joint result is identical to their own projectWealthPlan result', () => {
    const p = person({
      pension: 50_000,
      isaStocks: 20_000,
      salary: 50_000,
      pensionPct: 0.05,
      isaStocksMonthly: 200,
    })
    const joint = aggregateHousehold([p], A)
    const solo = projectWealthPlan(p, A)

    expect(joint.targetAge).toBe(solo.targetAge)
    expect(joint.todayTotal).toBe(solo.todayTotal)
    expect(joint.projectedTotal).toBeCloseTo(solo.projectedTotal, 6)
    expect(joint.whatYouPutIn).toBeCloseTo(solo.whatYouPutIn, 6)
    expect(joint.marketAdds).toBeCloseTo(solo.marketAdds, 6)
    expect(joint.pensionMonthly).toBe(solo.pensionMonthly)
    expect(joint.crossoverYear).toBe(solo.crossoverYear)
    expect(joint.yearly).toHaveLength(solo.yearly.length)
    for (let i = 0; i < joint.yearly.length; i++) {
      expect(joint.yearly[i]!.total.endValue).toBeCloseTo(solo.yearly[i]!.total.endValue, 6)
    }
  })

  it('two people with the same years left: pots sum directly, anchored to the younger age', () => {
    const p1 = person({ id: 'p1', name: 'A', age: 40, targetAge: 60, pension: 100_000 })
    const p2 = person({ id: 'p2', name: 'B', age: 35, targetAge: 55, isaStocks: 50_000 })
    const joint = aggregateHousehold([p1, p2], A)
    const r1 = projectWealthPlan(p1, A)
    const r2 = projectWealthPlan(p2, A)

    expect(joint.yearly).toHaveLength(r1.yearly.length)
    expect(joint.yearly).toHaveLength(r2.yearly.length)
    expect(joint.yearly[0]!.age).toBe(35) // anchored to the younger person
    expect(joint.targetAge).toBe(55)

    for (let y = 0; y < joint.yearly.length; y++) {
      expect(joint.yearly[y]!.pots.pension.endValue).toBeCloseTo(r1.yearly[y]!.pots.pension.endValue, 6)
      expect(joint.yearly[y]!.pots.isaStocks.endValue).toBeCloseTo(r2.yearly[y]!.pots.isaStocks.endValue, 6)
      expect(joint.yearly[y]!.total.endValue).toBeCloseTo(
        r1.yearly[y]!.total.endValue + r2.yearly[y]!.total.endValue,
        6,
      )
    }
    expect(joint.projectedTotal).toBeCloseTo(r1.projectedTotal + r2.projectedTotal, 6)
    expect(joint.todayTotal).toBe(r1.todayTotal + r2.todayTotal)
  })

  it('divergent retirement ages: the person who retires first keeps compounding with no further contributions', () => {
    // p1 has 10 years to go; p2 has 20 — the household must run the full 20
    const p1 = person({
      id: 'p1',
      name: 'A',
      age: 50,
      targetAge: 60,
      pension: 100_000,
      salary: 60_000,
      pensionPct: 0.1, // £500/month while active
    })
    const p2 = person({ id: 'p2', name: 'B', age: 40, targetAge: 60, isaStocks: 50_000, isaStocksMonthly: 200 })
    const joint = aggregateHousehold([p1, p2], A)
    const r1 = projectWealthPlan(p1, A) // p1's own 10-year run, indices 0..10
    const r2 = projectWealthPlan(p2, A) // p2's own 20-year run, indices 0..20

    expect(joint.yearly).toHaveLength(21) // 0..20
    expect(joint.targetAge).toBe(60) // anchor 40 + 20

    // years 0..10: p1's pension matches their own (still-active) forecast exactly
    for (let y = 0; y <= 10; y++) {
      expect(joint.yearly[y]!.pots.pension.endValue).toBeCloseTo(r1.yearly[y]!.pots.pension.endValue, 6)
    }

    // year 11 onward: p1 has passed their own target age — no more pension
    // contribution, but the balance keeps compounding at the baseline rate
    const pensionAt10 = r1.yearly[10]!.pots.pension.endValue
    expect(joint.yearly[11]!.pots.pension.contribution).toBe(0)
    expect(joint.yearly[11]!.pots.pension.endValue).toBeCloseTo(pensionAt10 * 1.07, 4)
    expect(joint.yearly[11]!.pots.pension.growth).toBeCloseTo(pensionAt10 * 0.07, 4)

    // it keeps compounding, untouched, all the way to the household's horizon
    let expectedFinalPension = pensionAt10
    for (let y = 11; y <= 20; y++) expectedFinalPension *= 1.07
    expect(joint.yearly[20]!.pots.pension.endValue).toBeCloseTo(expectedFinalPension, 2)

    // meanwhile p2, who defines the horizon, keeps contributing every year —
    // their isaStocks in the joint result matches their own full 20-year run
    for (let y = 0; y <= 20; y++) {
      expect(joint.yearly[y]!.pots.isaStocks.endValue).toBeCloseTo(r2.yearly[y]!.pots.isaStocks.endValue, 6)
    }
  })

  it('sums pot-by-pot across people, not just the grand total', () => {
    const p1 = person({ id: 'p1', name: 'A', cashSavings: 10_000, cashSavingsMonthly: 100 })
    const p2 = person({ id: 'p2', name: 'B', cashSavings: 5_000, cashSavingsMonthly: 50 })
    const joint = aggregateHousehold([p1, p2], A)
    const r1 = projectWealthPlan(p1, A)
    const r2 = projectWealthPlan(p2, A)

    expect(joint.pots.cashSavings.today).toBe(15_000)
    expect(joint.pots.cashSavings.future).toBeCloseTo(
      r1.pots.cashSavings.future + r2.pots.cashSavings.future,
      6,
    )
    expect(joint.pots.cashSavings.contributions).toBeCloseTo(
      r1.pots.cashSavings.contributions + r2.pots.cashSavings.contributions,
      6,
    )
    // untouched pots stay at zero for both people
    expect(joint.pots.pension.future).toBe(0)
    expect(joint.whatYouPutIn + joint.marketAdds).toBeCloseTo(joint.projectedTotal, 6)
  })

  it("each person's own rate and contribution overrides apply only to their own pots", () => {
    const p1 = person({
      id: 'p1',
      name: 'A',
      pension: 100_000,
      rateOverrides: [{ year: 1, investedRate: 0 }],
    })
    const p2 = person({ id: 'p2', name: 'B', pension: 100_000 })
    const joint = aggregateHousehold([p1, p2], A)

    // p1's override suppressed year-1 growth on their own pension only
    expect(joint.yearly[1]!.pots.pension.endValue).toBeCloseTo(100_000 + 107_000, 1) // p1 flat, p2 grown
  })
})
