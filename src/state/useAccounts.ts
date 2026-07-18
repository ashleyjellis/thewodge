/**
 * Fetches the account list for a household via /api/accounts. Mirrors the API's
 * JSON shape locally — see useHousehold.ts for why this doesn't import server types.
 */
import { useCallback, useEffect, useState } from 'react'

export type AccountOwner = 'person_a' | 'person_b' | 'joint'
export type AccountType =
  | 'cash_isa'
  | 'stocks_isa'
  | 'pension'
  | 'lisa'
  | 'savings_account'
  | 'other'
export type PotCategory = 'pension' | 'investments' | 'cash'

export type Account = {
  id: string
  householdId: string
  personId: string | null
  owner: AccountOwner
  provider: string
  accountType: AccountType
  potCategory: PotCategory
  isRingFenced: boolean
  isGoalEarmarked: boolean
  monthlyContribution: number
  currentBalance: number | null
  createdAt: string
}

type State = {
  accounts: Account[]
  loading: boolean
  error: string | null
}

export function useAccounts(householdId: string | null) {
  const [state, setState] = useState<State>({ accounts: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!householdId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`/api/accounts?householdId=${encodeURIComponent(householdId)}`)
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed to load accounts')
      setState({ accounts: data.accounts, loading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'failed to load accounts',
      }))
    }
  }, [householdId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { ...state, refetch }
}
