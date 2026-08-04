/**
 * The full forecast-snapshot history — every baseline, replan and checkpoint
 * ever saved, oldest first, mirroring /api/forecast's own order — plus a way
 * to save a new checkpoint. Kept separate from useForecast.ts (which /app
 * still depends on via its own narrower 'baseline' | 'replan' type): this is
 * the one place that widens to include 'checkpoint'.
 */
import { useCallback, useEffect, useState } from 'react'
import { postJson } from '@/lib/apiClient'

export type ForecastHistoryEntry = {
  id: string
  householdId: string
  createdAt: string
  type: 'baseline' | 'replan' | 'checkpoint'
  householdStateJson: string
  note: string | null
}

type State = {
  history: ForecastHistoryEntry[]
  loading: boolean
  error: string | null
}

export function useCheckpoints(householdId: string | null) {
  const [state, setState] = useState<State>({ history: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!householdId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`/api/forecast?householdId=${encodeURIComponent(householdId)}`)
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed to load plan history')
      setState({ history: data.history ?? [], loading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'failed to load plan history',
      }))
    }
  }, [householdId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const saveCheckpoint = useCallback(
    async (label?: string) => {
      await postJson('/api/forecast', {
        householdId,
        kind: 'checkpoint',
        ...(label?.trim() ? { label: label.trim() } : {}),
      })
      await refetch()
    },
    [householdId, refetch],
  )

  return { ...state, refetch, saveCheckpoint }
}
