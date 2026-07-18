import { describe, expect, it } from 'vitest'
import {
  forecast,
  futureValueContributions,
  monthlyRate,
  projectTotal,
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
    expect(r.cashFuture).toBeCloseTo(148_594.74, 1) // 100k × 1.02^20
    expect(r.investedFuture).toBe(0)
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
