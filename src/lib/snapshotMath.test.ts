import { describe, expect, it } from 'vitest'
import {
  estimateContribution,
  hasBeenUpdated,
  latestSnapshotByAccount,
  monthsBetween,
  periodGrowth,
  rollupSnapshotsByYear,
  totalGrowth,
  type SnapshotLike,
} from './snapshotMath'

describe('periodGrowth (client mirror — never a raw balance diff)', () => {
  it('nets money_in and transfer_out out of the balance change', () => {
    const g = periodGrowth({ startBalance: 1_000, endBalance: 1_300, moneyIn: 200, transferOut: 0 })
    expect(g.growth).toBe(100)
  })

  it('a withdrawal is not mistaken for a market loss', () => {
    const g = periodGrowth({ startBalance: 10_000, endBalance: 9_500, moneyIn: 0, transferOut: 500 })
    expect(g.growth).toBe(0)
  })

  it('returns growth: null — never a silent zero — when either figure is missing', () => {
    expect(periodGrowth({ startBalance: 1_000, endBalance: 1_100, moneyIn: null, transferOut: 0 }).growth).toBeNull()
    expect(periodGrowth({ startBalance: 1_000, endBalance: 1_100, moneyIn: 50, transferOut: null }).growth).toBeNull()
  })
})

describe('monthsBetween / estimateContribution (client mirror)', () => {
  it('counts whole calendar months', () => {
    expect(monthsBetween({ year: 2025, month: 1 }, { year: 2025, month: 4 })).toBe(3)
    expect(monthsBetween({ year: 2025, month: 11 }, { year: 2026, month: 2 })).toBe(3)
  })

  it('estimates money_in from the known monthly contribution, transfer_out always 0', () => {
    expect(estimateContribution(500, 3)).toEqual({ moneyIn: 1_500, transferOut: 0 })
  })
})

describe('rollupSnapshotsByYear', () => {
  const snap = (over: Partial<SnapshotLike>): SnapshotLike => ({
    year: 2025,
    month: 1,
    startBalance: 0,
    endBalance: 0,
    moneyIn: 0,
    transferOut: 0,
    isEstimated: false,
    ...over,
  })

  it('groups by calendar year, one row per year', () => {
    const rows = rollupSnapshotsByYear([
      snap({ year: 2024, month: 6, startBalance: 1_000, endBalance: 1_200, moneyIn: 100, transferOut: 0 }),
      snap({ year: 2025, month: 2, startBalance: 1_200, endBalance: 1_500, moneyIn: 200, transferOut: 0 }),
      snap({ year: 2025, month: 8, startBalance: 1_500, endBalance: 1_900, moneyIn: 300, transferOut: 0 }),
    ])
    expect(rows.map((r) => r.year)).toEqual([2024, 2025])
  })

  it("uses the year's first snapshot start and last snapshot end", () => {
    const rows = rollupSnapshotsByYear([
      snap({ year: 2025, month: 2, startBalance: 1_200, endBalance: 1_500, moneyIn: 200, transferOut: 0 }),
      snap({ year: 2025, month: 8, startBalance: 1_500, endBalance: 1_900, moneyIn: 300, transferOut: 0 }),
    ])
    expect(rows[0]!.startBalance).toBe(1_200)
    expect(rows[0]!.endBalance).toBe(1_900)
  })

  it('sums money_in and transfer_out across the year', () => {
    const rows = rollupSnapshotsByYear([
      snap({ year: 2025, month: 2, moneyIn: 200, transferOut: 0 }),
      snap({ year: 2025, month: 8, moneyIn: 300, transferOut: 500 }),
    ])
    expect(rows[0]!.moneyIn).toBe(500)
    expect(rows[0]!.transferOut).toBe(500)
  })

  it('a missing money_in anywhere in the year makes the whole year null, not silently zero', () => {
    const rows = rollupSnapshotsByYear([
      snap({ year: 2025, month: 2, moneyIn: 200, transferOut: 0 }),
      snap({ year: 2025, month: 8, moneyIn: null, transferOut: 0 }),
    ])
    expect(rows[0]!.moneyIn).toBeNull()
  })

  it('marks the year estimated if any snapshot within it was an estimate', () => {
    const rows = rollupSnapshotsByYear([
      snap({ year: 2025, month: 2, isEstimated: false }),
      snap({ year: 2025, month: 8, isEstimated: true }),
    ])
    expect(rows[0]!.isEstimated).toBe(true)
  })

  it('returns an empty array for no snapshots', () => {
    expect(rollupSnapshotsByYear([])).toEqual([])
  })
})

describe('totalGrowth', () => {
  const snap = (over: Partial<SnapshotLike>): SnapshotLike => ({
    year: 2025,
    month: 1,
    startBalance: 0,
    endBalance: 0,
    moneyIn: 0,
    transferOut: 0,
    isEstimated: false,
    ...over,
  })

  it('sums known growth across every snapshot', () => {
    const t = totalGrowth([
      snap({ startBalance: 1_000, endBalance: 1_100, moneyIn: 0, transferOut: 0 }),
      snap({ startBalance: 1_100, endBalance: 1_300, moneyIn: 100, transferOut: 0 }),
    ])
    expect(t.total).toBe(200) // 100 + 100
    expect(t.missingCount).toBe(0)
    expect(t.hasAny).toBe(true)
  })

  it('excludes a period with missing data from the total rather than treating it as zero', () => {
    const t = totalGrowth([
      snap({ startBalance: 1_000, endBalance: 1_100, moneyIn: 0, transferOut: 0 }), // +100
      snap({ startBalance: 1_100, endBalance: 5_000, moneyIn: null, transferOut: 0 }), // unknown, excluded
    ])
    expect(t.total).toBe(100) // the huge unexplained jump is NOT silently counted
    expect(t.missingCount).toBe(1)
  })

  it('hasAny is false for no snapshots', () => {
    expect(totalGrowth([]).hasAny).toBe(false)
    expect(totalGrowth([]).total).toBe(0)
  })
})

describe('hasBeenUpdated', () => {
  it('is false when every account only has its opening entry', () => {
    expect(
      hasBeenUpdated([
        { accountId: 'a' },
        { accountId: 'b' },
      ]),
    ).toBe(false)
  })

  it('is true once any single account has two or more snapshots', () => {
    expect(
      hasBeenUpdated([
        { accountId: 'a' },
        { accountId: 'a' },
        { accountId: 'b' },
      ]),
    ).toBe(true)
  })

  it('is false for no snapshots', () => {
    expect(hasBeenUpdated([])).toBe(false)
  })
})

describe('latestSnapshotByAccount', () => {
  it('picks the most recently recorded snapshot per account', () => {
    const rows = [
      { accountId: 'a', recordedAt: '2025-01-01T00:00:00.000Z', tag: 'old-a' },
      { accountId: 'a', recordedAt: '2025-06-01T00:00:00.000Z', tag: 'new-a' },
      { accountId: 'b', recordedAt: '2025-03-01T00:00:00.000Z', tag: 'only-b' },
    ]
    const latest = latestSnapshotByAccount(rows)
    expect(latest.get('a')!.tag).toBe('new-a')
    expect(latest.get('b')!.tag).toBe('only-b')
  })

  it('returns an empty map for no snapshots', () => {
    expect(latestSnapshotByAccount([]).size).toBe(0)
  })
})
