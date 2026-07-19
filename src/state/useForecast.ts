/**
 * Fetches the household's forecast plan-of-record (+ original baseline) via
 * /api/forecast, auto-creating a baseline on first visit. Mirrors the API's
 * JSON shape locally — see useHousehold.ts for why this doesn't import
 * server types.
 */
import { useCallback, useEffect, useState } from 'react'

export type ForecastSnapshot = {
  id: string
  householdId: string
  createdAt: string
  type: 'baseline' | 'replan'
  householdStateJson: string
  note: string | null
}

type State = {
  ready: boolean
  current: ForecastSnapshot | null
  original: ForecastSnapshot | null
  loading: boolean
  error: string | null
}

export function useForecast(householdId: string | null) {
  const [state, setState] = useState<State>({
    ready: false,
    current: null,
    original: null,
    loading: true,
    error: null,
  })

  const refetch = useCallback(async () => {
    if (!householdId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`/api/forecast?householdId=${encodeURIComponent(householdId)}`)
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed to load forecast')
      setState({
        ready: data.ready,
        current: data.current ?? null,
        original: data.original ?? null,
        loading: false,
        error: null,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'failed to load forecast',
      }))
    }
  }, [householdId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { ...state, refetch }
}
