import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from './testHelpers'
import { createHousehold } from './households'
import { createPerson } from './people'
import { createAccount, getAccount } from './accounts'
import {
  estimateContribution,
  getLatestSnapshot,
  insertSnapshot,
  listSnapshots,
  listSnapshotsForHousehold,
  monthsBetween,
  periodGrowth,
} from './accountSnapshots'
import type { Db } from './client'

describe('periodGrowth (never a raw balance diff)', () => {
  it('nets money_in and transfer_out out of the balance change', () => {
    // £1,000 grew to £1,300 after £200 was added — £100 of that is market growth
    const g = periodGrowth({ startBalance: 1_000, endBalance: 1_300, moneyIn: 200, transferOut: 0 })
    expect(g.growth).toBe(100)
  })

  it('a withdrawal is not mistaken for a market loss', () => {
    // this is exactly the bug class the spec calls out: a raw diff would read
    // this as a £500 loss (−5%); netted, the market was flat.
    const g = periodGrowth({
      startBalance: 10_000,
      endBalance: 9_500,
      moneyIn: 0,
      transferOut: 500,
    })
    expect(g.growth).toBe(0)
  })

  it('shows both a contribution and a withdrawal in the same period distinctly', () => {
    // £1,000 in, £500 out, balance still grew by £50 net of both
    const g = periodGrowth({
      startBalance: 10_000,
      endBalance: 10_550,
      moneyIn: 1_000,
      transferOut: 500,
    })
    expect(g.growth).toBe(50)
  })

  it('returns growth: null — never a silent zero — when money_in is missing', () => {
    const g = periodGrowth({ startBalance: 1_000, endBalance: 1_100, moneyIn: null, transferOut: 0 })
    expect(g.growth).toBeNull()
    expect(g.moneyInMissing).toBe(true)
  })

  it('returns growth: null when transfer_out is missing', () => {
    const g = periodGrowth({ startBalance: 1_000, endBalance: 1_100, moneyIn: 50, transferOut: null })
    expect(g.growth).toBeNull()
    expect(g.transferOutMissing).toBe(true)
  })
})

describe('monthsBetween / estimateContribution', () => {
  it('counts whole calendar months', () => {
    expect(monthsBetween({ year: 2025, month: 1 }, { year: 2025, month: 4 })).toBe(3)
    expect(monthsBetween({ year: 2025, month: 11 }, { year: 2026, month: 2 })).toBe(3)
  })

  it('estimates money_in from the known monthly contribution, transfer_out always 0', () => {
    expect(estimateContribution(500, 3)).toEqual({ moneyIn: 1_500, transferOut: 0 })
    expect(estimateContribution(500, 0)).toEqual({ moneyIn: 0, transferOut: 0 })
  })
})

describe('account_snapshots (append-only, against a real migrated database)', () => {
  let db: Db
  let cleanup: () => void
  let accountId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    const h = await createHousehold(db)
    const p = await createPerson(db, { householdId: h.id, name: 'Sam', age: 36 })
    const a = await createAccount(db, {
      householdId: h.id,
      personId: p.id,
      owner: 'person_a',
      provider: 'HL',
      accountType: 'stocks_isa',
      openingBalance: 76_000,
    })
    accountId = a.id
  })
  afterAll(() => cleanup())

  it('inserting a new snapshot syncs the account current_balance', async () => {
    await insertSnapshot(db, {
      accountId,
      year: 2025,
      month: 2,
      startBalance: 76_000,
      moneyIn: 900,
      transferOut: 0,
      endBalance: 78_500,
    })
    const acc = await getAccount(db, accountId)
    expect(acc!.currentBalance).toBe(78_500)
  })

  it('never overwrites a previous period — each call appends a new row', async () => {
    await insertSnapshot(db, {
      accountId,
      year: 2025,
      month: 3,
      startBalance: 78_500,
      moneyIn: 900,
      transferOut: 0,
      endBalance: 80_000,
    })
    // insert a THIRD row for the same (account, year, month) as an existing one —
    // this must add a new row, never upsert/overwrite
    await insertSnapshot(db, {
      accountId,
      year: 2025,
      month: 3,
      startBalance: 80_000,
      moneyIn: 0,
      transferOut: 0,
      endBalance: 80_200,
      note: 'correction later the same month',
    })
    const snaps = await listSnapshots(db, accountId)
    const marchRows = snaps.filter((s) => s.year === 2025 && s.month === 3)
    expect(marchRows).toHaveLength(2) // both kept — never rewritten
  })

  it('is_estimated defaults to false and can be set explicitly', async () => {
    const s = await insertSnapshot(db, {
      accountId,
      year: 2025,
      month: 4,
      startBalance: 80_200,
      moneyIn: 900,
      transferOut: 0,
      endBalance: 81_500,
      isEstimated: true,
    })
    expect(s.isEstimated).toBe(true)
  })

  it('getLatestSnapshot returns the most recently recorded row', async () => {
    const latest = await getLatestSnapshot(db, accountId)
    expect(latest).not.toBeNull()
    expect(latest!.accountId).toBe(accountId)
  })

  it('preserves a note distinct from the numeric fields', async () => {
    const s = await insertSnapshot(db, {
      accountId,
      year: 2025,
      month: 5,
      startBalance: 81_500,
      moneyIn: 0,
      transferOut: 5_000,
      endBalance: 77_200,
      note: 'pulled £5k for the wedding',
    })
    expect(s.note).toBe('pulled £5k for the wedding')
    expect(periodGrowth(s).growth).toBeCloseTo(700, 6) // 77200-81500-0+5000
  })
})

describe('listSnapshotsForHousehold', () => {
  it('returns snapshots across every account in the household, none from another household', async () => {
    const { db, cleanup } = await createMigratedTestDb()
    try {
      const h1 = await createHousehold(db)
      const p1 = await createPerson(db, { householdId: h1.id, name: 'Sam', age: 36 })
      const a1 = await createAccount(db, {
        householdId: h1.id,
        personId: p1.id,
        owner: 'person_a',
        provider: 'HL',
        accountType: 'stocks_isa',
        openingBalance: 10_000,
      })
      const a2 = await createAccount(db, {
        householdId: h1.id,
        personId: null,
        owner: 'joint',
        provider: 'Chase',
        accountType: 'savings_account',
        openingBalance: 5_000,
      })

      // a second, unrelated household — must never leak into the first's results
      const h2 = await createHousehold(db)
      const p2 = await createPerson(db, { householdId: h2.id, name: 'Alex', age: 40 })
      await createAccount(db, {
        householdId: h2.id,
        personId: p2.id,
        owner: 'person_a',
        provider: 'Vanguard',
        accountType: 'lisa',
        openingBalance: 99_000,
      })

      await insertSnapshot(db, {
        accountId: a1.id,
        year: 2025,
        month: 6,
        startBalance: 10_000,
        moneyIn: 300,
        transferOut: 0,
        endBalance: 10_400,
      })

      const rows = await listSnapshotsForHousehold(db, h1.id)
      const accountIds = new Set(rows.map((r) => r.accountId))
      // both h1 accounts' opening snapshots plus the one just inserted = 3
      expect(rows.length).toBe(3)
      expect(accountIds.has(a1.id)).toBe(true)
      expect(accountIds.has(a2.id)).toBe(true)
    } finally {
      cleanup()
    }
  })
})
