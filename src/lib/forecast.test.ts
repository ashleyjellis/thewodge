import { describe, expect, it } from 'vitest'
import {
  findCrossoverYear,
  forecast,
  futureValueContributions,
  monthlyRate,
  projectTotal,
  projectYearly,
  type Assumptions,
  type ForecastInput,
} from './forecast'

const A: Assumptions = { investedRate: 0.07, cashRate: 0.02, targetAge: 60 }

describe('forecast (pure, nominal)', () => {
  it('projects invested-only growth at the equity rate', () => {
    const input: ForecastInput = {
      age: 40,
      pension: 100_000,
      stocks: 0,
      cash: 0,
      monthly: 0,
    }
    const r = forecast(input, A)
    expect(r.monthsToTarget).toBe(240)
    expect(r.projectedTotal).toBeCloseTo(386_968.45, 1) // 100k × 1.07^20
    expect(r.todayTotal).toBe(100_000)
    expect(r.marketAdds).toBeCloseTo(286_968.45, 1)
    expect(r.totalContributions).toBe(0)
    expect(r.whatYouPutIn).toBe(100_000)
  })

  it('grows cash at the LOWER rate, never the equity rate', () => {
    const input: ForecastInput = {
      age: 40,
      pension: 0,
      stocks: 0,
      cash: 100_000,
      monthly: 0,
    }
    const r = forecast(input, A)
    expect(r.cash.future).toBeCloseTo(148_594.74, 1) // 100k × 1.02^20
    expect(r.pension.future).toBe(0)
    expect(r.stocks.future).toBe(0)
    // decisively lower than the same sum invested (386,968)
    expect(r.projectedTotal).toBeLessThan(200_000)
  })

  it('adds monthly contributions to the invested pot', () => {
    const input: ForecastInput = {
      age: 40,
      pension: 0,
      stocks: 0,
      cash: 0,
      monthly: 500,
    }
    const r = forecast(input, A)
    expect(r.projectedTotal).toBeCloseTo(253_768.19, 1)
    expect(r.totalContributions).toBe(500 * 240)
    expect(r.whatYouPutIn).toBe(120_000)
    expect(r.marketAdds).toBeCloseTo(253_768.19 - 120_000, 1)
  })

  it('handles zero everything and age at/after target', () => {
    const atTarget = forecast(
      { age: 60, pension: 100_000, stocks: 0, cash: 0, monthly: 0 },
      A,
    )
    expect(atTarget.monthsToTarget).toBe(0)
    expect(atTarget.projectedTotal).toBe(100_000)
    expect(atTarget.marketAdds).toBe(0)

    const empty = forecast({ age: 40, pension: 0, stocks: 0, cash: 0, monthly: 0 }, A)
    expect(empty.projectedTotal).toBe(0)
    expect(empty.marketAdds).toBe(0)
  })

  it('splits the whole picture into what-you-put-in vs what-the-market-adds', () => {
    const r = forecast(
      { age: 40, pension: 50_000, stocks: 50_000, cash: 20_000, monthly: 0 },
      A,
    )
    expect(r.projectedTotal).toBeCloseTo(416_687.39, 1)
    expect(r.whatYouPutIn).toBe(120_000)
    expect(r.whatYouPutIn + r.marketAdds).toBeCloseTo(r.projectedTotal, 6)
  })

  it('produces the four scenarios, monotonic, with carry-on flagged current', () => {
    const input: ForecastInput = {
      age: 40,
      pension: 100_000,
      stocks: 0,
      cash: 0,
      monthly: 200,
    }
    const { scenarios } = forecast(input, A)
    const byKey = Object.fromEntries(scenarios.map((s) => [s.key, s]))

    expect(byKey.stop!.monthly).toBe(0)
    expect(byKey.carryOn!.monthly).toBe(200)
    expect(byKey.add100!.monthly).toBe(300)
    expect(byKey.add500!.monthly).toBe(700)

    expect(byKey.stop!.total).toBeCloseTo(386_968.45, 1)
    expect(byKey.carryOn!.total).toBeCloseTo(488_475.72, 1)
    expect(byKey.add100!.total).toBeCloseTo(539_229.36, 1)
    expect(byKey.add500!.total).toBeCloseTo(742_243.91, 1)

    // strictly increasing with contribution
    expect(byKey.stop!.total).toBeLessThan(byKey.carryOn!.total)
    expect(byKey.carryOn!.total).toBeLessThan(byKey.add100!.total)
    expect(byKey.add100!.total).toBeLessThan(byKey.add500!.total)

    expect(byKey.carryOn!.current).toBe(true)
    expect(byKey.add500!.current).toBe(false)
  })
})

describe('per-pot breakdown', () => {
  it('splits pension, stocks and cash independently and sums to the total', () => {
    const r = forecast(
      { age: 40, pension: 50_000, stocks: 50_000, cash: 20_000, monthly: 0 },
      A,
    )
    expect(r.pension.future).toBeCloseTo(193_484.22, 1) // 50k × 1.07^20
    expect(r.stocks.future).toBeCloseTo(193_484.22, 1)
    expect(r.cash.future).toBeCloseTo(29_718.95, 1) // 20k × 1.02^20
    expect(r.pension.future + r.stocks.future + r.cash.future).toBeCloseTo(
      r.projectedTotal,
      6,
    )
  })

  it('sends the monthly contribution to stocks only — pension and cash are lump-only', () => {
    const r = forecast(
      { age: 40, pension: 100_000, stocks: 0, cash: 50_000, monthly: 300 },
      A,
    )
    expect(r.pension.contributions).toBe(0)
    expect(r.cash.contributions).toBe(0)
    expect(r.stocks.contributions).toBe(300 * 240)
    expect(r.totalContributions).toBe(300 * 240)
  })

  it('each pot breakdown satisfies future = today + contributions + growth', () => {
    const r = forecast(
      { age: 50, pension: 80_000, stocks: 40_000, cash: 15_000, monthly: 250 },
      A,
    )
    for (const pot of [r.pension, r.stocks, r.cash]) {
      expect(pot.today + pot.contributions + pot.growth).toBeCloseTo(pot.future, 6)
    }
  })
})

describe('projectYearly', () => {
  const input: ForecastInput = {
    age: 40,
    pension: 100_000,
    stocks: 0,
    cash: 0,
    monthly: 300,
  }

  it('starts at today with zero growth and zero contribution', () => {
    const yearly = projectYearly(input, A)
    expect(yearly[0]).toMatchObject({
      year: 0,
      age: 40,
      pension: { startValue: 100_000, contribution: 0, growth: 0, endValue: 100_000 },
      stocks: { startValue: 0, contribution: 0, growth: 0, endValue: 0 },
    })
  })

  it('matches the hand-computed year-1 and year-3 figures', () => {
    const yearly = projectYearly(input, A)
    expect(yearly[1]!.pension.endValue).toBeCloseTo(107_000, 0)
    expect(yearly[1]!.pension.growth).toBeCloseTo(7_000, 0)
    expect(yearly[1]!.stocks.endValue).toBeCloseTo(3_714.09, 1)
    expect(yearly[1]!.stocks.contribution).toBe(3_600)
    expect(yearly[3]!.pension.endValue).toBeCloseTo(122_504.30, 1)
    expect(yearly[3]!.stocks.endValue).toBeCloseTo(11_940.43, 1)
  })

  it('the final year matches forecast()’s projected total', () => {
    const yearly = projectYearly(input, A)
    const last = yearly[yearly.length - 1]!
    expect(last.year).toBe(20)
    expect(last.total.endValue).toBeCloseTo(forecast(input, A).projectedTotal, 4)
  })

  it('every year keeps endValue = startValue + contribution + growth, per pot', () => {
    const yearly = projectYearly(
      { age: 35, pension: 40_000, stocks: 10_000, cash: 10_000, monthly: 200 },
      A,
    )
    for (const p of yearly) {
      for (const pot of [p.pension, p.stocks, p.cash, p.total]) {
        expect(pot.startValue + pot.contribution + pot.growth).toBeCloseTo(
          pot.endValue,
          6,
        )
      }
    }
  })

  it('produces years = round(targetAge - age) points after today', () => {
    const yearly = projectYearly({ ...input, age: 45 }, A)
    expect(yearly.length).toBe(16) // year 0..15
  })
})

describe('findCrossoverYear', () => {
  it('finds the first year total growth exceeds total contribution', () => {
    const yearly = projectYearly(
      { age: 40, pension: 100_000, stocks: 0, cash: 0, monthly: 300 },
      A,
    )
    // a £100k pension lump means growth outpaces a modest £300/mo immediately
    expect(findCrossoverYear(yearly)).toBe(1)
  })

  it('returns null when there is nothing to grow', () => {
    const yearly = projectYearly(
      { age: 40, pension: 0, stocks: 0, cash: 0, monthly: 0 },
      A,
    )
    expect(findCrossoverYear(yearly)).toBeNull()
  })

  it('is later when starting from a small pot with a real contribution', () => {
    const yearly = projectYearly(
      { age: 30, pension: 0, stocks: 5_000, cash: 0, monthly: 400 },
      A,
    )
    const year = findCrossoverYear(yearly)
    expect(year).not.toBeNull()
    // whatever year it is, growth must exceed contribution then and not before
    const at = yearly.find((p) => p.year === year)!
    expect(at.total.growth).toBeGreaterThan(at.total.contribution)
    const before = yearly.find((p) => p.year === year! - 1)
    if (before && before.year >= 1) {
      expect(before.total.growth).toBeLessThanOrEqual(before.total.contribution)
    }
  })

  it('is exposed on the forecast result and matches projectYearly directly', () => {
    const input: ForecastInput = { age: 40, pension: 100_000, stocks: 0, cash: 0, monthly: 300 }
    const r = forecast(input, A)
    expect(r.crossoverYear).toBe(findCrossoverYear(projectYearly(input, A)))
  })
})

describe('forecast helpers', () => {
  it('monthlyRate is the effective monthly equivalent', () => {
    expect(Math.pow(1 + monthlyRate(0.07), 12)).toBeCloseTo(1.07, 10)
  })

  it('contribution FV degrades to simple sum at zero rate', () => {
    expect(futureValueContributions(100, 0, 12)).toBe(1_200)
  })

  it('projectTotal matches forecast for the same monthly', () => {
    const input: ForecastInput = {
      age: 45,
      pension: 30_000,
      stocks: 20_000,
      cash: 5_000,
      monthly: 300,
    }
    expect(projectTotal(input, 300, A)).toBeCloseTo(forecast(input, A).projectedTotal, 6)
  })
})
