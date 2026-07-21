/**
 * Fetches every salary_changes row across the household via
 * /api/salaryChanges. Mirrors the API's JSON shape locally — see
 * useHousehold.ts for why this doesn't import server types.
 */
import { useCallback, useEffect, useState } from 'react'

export type SalaryChange = {
  id: string
  personId: string
  effectiveYear: number
  salary: number
  note: string | null
  createdAt: string
}

type State = {
  salaryChanges: SalaryChange[]
  loading: boolean
  error: string | null
}

export function useSalaryChanges(householdId: string | null) {
  const [state, setState] = useState<State>({ salaryChanges: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!householdId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`/api/salaryChanges?householdId=${encodeURIComponent(householdId)}`)
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed to load salary changes')
      setState({ salaryChanges: data.salaryChanges, loading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'failed to load salary changes',
      }))
    }
  }, [householdId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { ...state, refetch }
}
