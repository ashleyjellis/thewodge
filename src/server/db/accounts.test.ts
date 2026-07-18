import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { createMigratedTestDb } from './testHelpers'
import { createHousehold } from './households'
import { createPerson } from './people'
import {
  accountTypeToPotCategory,
  AccountAlreadyHasBalanceError,
  AccountOwnershipError,
  createAccount,
  getAccount,
  InvalidBalanceError,
  isValidAccountOwner,
  listAccounts,
  recordUpdate,
  rollupByPotCategory,
  setOpeningBalance,
  updateAccount,
} from './accounts'
import { listSnapshots, periodGrowth } from './accountSnapshots'
import type { Db } from './client'

describe('accountTypeToPotCategory (fixed mapping, spec §0)', () => {
  it('maps every account type to its pot category', () => {
    expect(accountTypeToPotCategory('pension')).toBe('pension')
    expect(accountTypeToPotCategory('cash_isa')).toBe('cash')
    expect(accountTypeToPotCategory('savings_account')).toBe('cash')
    expect(accountTypeToPotCategory('stocks_isa')).toBe('investments')
    expect(accountTypeToPotCategory('lisa')).toBe('investments')
    expect(accountTypeToPotCategory('other')).toBe('investments')
  })
})

describe('isValidAccountOwner', () => {
  it('accepts the three valid owners and rejects anything else', () => {
    expect(isValidAccountOwner('person_a')).toBe(true)
    expect(isValidAccountOwner('person_b')).toBe(true)
    expect(isValidAccountOwner('joint')).toBe(true)
    expect(isValidAccountOwner('person_c')).toBe(false)
  })
})

describe('accounts (against a real migrated database)', () => {
  let db: Db
  let cleanup: () => void
  let householdId: string
  let personId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    const h = await createHousehold(db)
    householdId = h.id
    const p = await createPerson(db, { householdId, name: 'Sam', age: 36 })
    personId = p.id
  })
  afterAll(() => cleanup())

  it('derives pot_category from account_type — never accepts it as input', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'HL',
      accountType: 'stocks_isa',
    })
    expect(a.potCategory).toBe('investments')
    // structurally impossible to pass potCategory in — NewAccount has no such field
  })

  it('rejects a joint account tied to a single person', async () => {
    await expect(
      createAccount(db, {
        householdId,
        personId,
        owner: 'joint',
        provider: 'Chase',
        accountType: 'savings_account',
      }),
    ).rejects.toBeInstanceOf(AccountOwnershipError)
  })

  it('rejects a non-joint account with no person', async () => {
    await expect(
      createAccount(db, {
        householdId,
        personId: null,
        owner: 'person_a',
        provider: 'Chase',
        accountType: 'savings_account',
      }),
    ).rejects.toBeInstanceOf(AccountOwnershipError)
  })

  it('accepts a joint account with no person', async () => {
    const a = await createAccount(db, {
      householdId,
      personId: null,
      owner: 'joint',
      provider: 'Chase',
      accountType: 'savings_account',
    })
    expect(a.owner).toBe('joint')
    expect(a.personId).toBeNull()
    expect(a.potCategory).toBe('cash')
  })

  it('creating with an opening balance writes the first append-only snapshot', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Trading 212',
      accountType: 'pension',
      openingBalance: 145_000,
    })
    expect(a.currentBalance).toBe(145_000)
    const snaps = await listSnapshots(db, a.id)
    expect(snaps).toHaveLength(1)
    expect(snaps[0]!.startBalance).toBe(145_000)
    expect(snaps[0]!.endBalance).toBe(145_000)
    // known-zero (there's no prior period), not the "missing data" null —
    // otherwise a real update later the same year would taint the annual
    // rollup's contribution figure as "unknown" for a perfectly well-defined
    // opening entry
    expect(snaps[0]!.moneyIn).toBe(0)
    expect(snaps[0]!.transferOut).toBe(0)
  })

  it('creating with no opening balance leaves current_balance null and no snapshot', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Vanguard',
      accountType: 'lisa',
    })
    expect(a.currentBalance).toBeNull()
    expect(await listSnapshots(db, a.id)).toHaveLength(0)
  })

  it('updating account_type re-derives pot_category so they never drift', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Moneybox',
      accountType: 'cash_isa',
    })
    expect(a.potCategory).toBe('cash')
    await updateAccount(db, a.id, { accountType: 'stocks_isa' })
    const reloaded = await getAccount(db, a.id)
    expect(reloaded!.accountType).toBe('stocks_isa')
    expect(reloaded!.potCategory).toBe('investments')
  })

  it('rollupByPotCategory sums current_balance by pot, across accounts', async () => {
    const accs = await listAccounts(db, householdId)
    const rollup = rollupByPotCategory(accs)
    const expectedPension = accs
      .filter((x) => x.potCategory === 'pension')
      .reduce((s, x) => s + (x.currentBalance ?? 0), 0)
    expect(rollup.pension).toBeCloseTo(expectedPension, 6)
    expect(rollup.pension + rollup.investments + rollup.cash).toBeCloseTo(
      accs.reduce((s, x) => s + (x.currentBalance ?? 0), 0),
      6,
    )
  })

  it('the owner CHECK constraint is enforced by the database itself, not just app code', async () => {
    // bypass the data-access layer entirely — raw insert with an invalid owner
    await expect(
      db.run(sql`
        INSERT INTO accounts
          (id, household_id, person_id, owner, provider, account_type, pot_category, created_at)
        VALUES
          ('bad-row', ${householdId}, ${personId}, 'person_c', 'Test', 'pension', 'pension', ${new Date().toISOString()})
      `),
    ).rejects.toThrow()
  })

  it('the owner/person_id relationship CHECK constraint is enforced by the database', async () => {
    await expect(
      db.run(sql`
        INSERT INTO accounts
          (id, household_id, person_id, owner, provider, account_type, pot_category, created_at)
        VALUES
          ('bad-row-2', ${householdId}, NULL, 'person_a', 'Test', 'pension', 'pension', ${new Date().toISOString()})
      `),
    ).rejects.toThrow()
  })

  it('updateAccount tolerates an empty patch (a PATCH carrying only openingBalance)', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Nutmeg',
      accountType: 'lisa',
    })
    await expect(updateAccount(db, a.id, {})).resolves.not.toThrow()
  })

  it('setOpeningBalance records the first balance for an account created without one', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Aviva',
      accountType: 'pension',
    })
    expect(a.currentBalance).toBeNull()

    await setOpeningBalance(db, a.id, 42_000)

    const reloaded = await getAccount(db, a.id)
    expect(reloaded!.currentBalance).toBe(42_000)
    const snaps = await listSnapshots(db, a.id)
    expect(snaps).toHaveLength(1)
    expect(snaps[0]!.startBalance).toBe(42_000)
    expect(snaps[0]!.endBalance).toBe(42_000)
  })

  it('setOpeningBalance rejects an account that already has a balance', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Fidelity',
      accountType: 'pension',
      openingBalance: 10_000,
    })
    await expect(setOpeningBalance(db, a.id, 20_000)).rejects.toBeInstanceOf(
      AccountAlreadyHasBalanceError,
    )
    // unchanged — the rejected call must not have written anything
    const reloaded = await getAccount(db, a.id)
    expect(reloaded!.currentBalance).toBe(10_000)
    expect(await listSnapshots(db, a.id)).toHaveLength(1)
  })

  it('recordUpdate: first-ever update on an account with no balance treats it as the opening figure (start = end)', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Nest',
      accountType: 'pension',
    })
    const snap = await recordUpdate(db, a.id, {
      endBalance: 5_000,
      moneyIn: 0,
      transferOut: 0,
      isEstimated: false,
    })
    expect(snap.startBalance).toBe(5_000)
    expect(snap.endBalance).toBe(5_000)
    expect(periodGrowth(snap).growth).toBe(0) // no fabricated growth from a fake £0 start
  })

  it('recordUpdate: a later update starts from the previous snapshot end_balance', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Scottish Widows',
      accountType: 'pension',
      openingBalance: 20_000,
    })
    const snap = await recordUpdate(db, a.id, {
      endBalance: 21_200,
      moneyIn: 1_000,
      transferOut: 0,
      isEstimated: true,
    })
    expect(snap.startBalance).toBe(20_000)
    expect(snap.endBalance).toBe(21_200)
    expect(snap.isEstimated).toBe(true)
    expect(periodGrowth(snap).growth).toBe(200) // 21200-20000-1000+0

    const reloaded = await getAccount(db, a.id)
    expect(reloaded!.currentBalance).toBe(21_200)
  })

  it('recordUpdate rejects a non-finite end balance rather than silently treating it as zero', async () => {
    const a = await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Legal & General',
      accountType: 'pension',
      openingBalance: 8_000,
    })
    await expect(
      recordUpdate(db, a.id, {
        endBalance: NaN,
        moneyIn: 0,
        transferOut: 0,
        isEstimated: false,
      }),
    ).rejects.toBeInstanceOf(InvalidBalanceError)
    // unchanged
    expect((await getAccount(db, a.id))!.currentBalance).toBe(8_000)
  })
})
