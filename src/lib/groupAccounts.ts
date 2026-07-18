/**
 * Groups accounts by person (then joint), then by pot category within each —
 * exactly the ordering spec §2 calls for. Pure and tested independent of the UI.
 */
import { ownerLabel, type AccountOwner } from './accountOwner'

const POT_ORDER = ['pension', 'investments', 'cash'] as const

export type GroupableAccount = {
  owner: AccountOwner
  potCategory: 'pension' | 'investments' | 'cash'
}

export type PotGroup<A> = {
  potCategory: (typeof POT_ORDER)[number]
  accounts: A[]
}

export type OwnerGroup<A> = {
  owner: AccountOwner
  label: string
  potGroups: PotGroup<A>[]
}

export function groupAccounts<A extends GroupableAccount>(
  accounts: A[],
  people: { id: string; name: string }[],
): OwnerGroup<A>[] {
  const owners: AccountOwner[] = ['person_a', 'person_b', 'joint']
  const groups: OwnerGroup<A>[] = []

  for (const owner of owners) {
    const ownerAccounts = accounts.filter((a) => a.owner === owner)
    if (ownerAccounts.length === 0) continue

    const potGroups: PotGroup<A>[] = POT_ORDER.map((pot) => ({
      potCategory: pot,
      accounts: ownerAccounts.filter((a) => a.potCategory === pot),
    })).filter((g) => g.accounts.length > 0)

    groups.push({ owner, label: ownerLabel(owner, people), potGroups })
  }

  return groups
}
