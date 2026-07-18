/**
 * Fetches every account_snapshots row across the household via /api/snapshots.
 * Mirrors the API's JSON shape locally — see useHousehold.ts for why this
 * doesn't import server types.
 */
import { useCallback, useEffect, useState } from 'react'

export type Snapshot = {
  id: string
  accountId: string
  recordedAt: string
  year: number
  month: number
  startBalance: number
  moneyIn: number | null
  transferOut: number | null
  endBalance: number
  isEstimated: boolean
  note: string | null
}

type State = {
  snapshots: Snapshot[]
  loading: boolean
  error: string | null
}

export function useSnapshots(householdId: string | null) {
  const [state, setState] = useState<State>({ snapshots: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!householdId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`/api/snapshots?householdId=${encodeURIComponent(householdId)}`)
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed to load snapshots')
      setState({ snapshots: data.snapshots, loading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'failed to load snapshots',
      }))
    }
  }, [householdId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { ...state, refetch }
}
