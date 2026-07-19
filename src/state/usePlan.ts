/**
 * Fetches the household's live contribution schedule + planned events via
 * /api/plan — the Plan table's editable input. Mirrors the API's JSON shape
 * locally, same reasoning as useHousehold.ts.
 */
import { useCallback, useEffect, useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { ContributionChangeType } from '@/lib/scheduledPlan'
import { postJson, sendDelete } from '@/lib/apiClient'

export type ContributionChange = {
  id: string
  householdId: string
  owner: AccountOwner
  potCategory: PotCategory
  effectiveYear: number
  changeType: ContributionChangeType
  value: number
  note: string | null
  createdAt: string
}

export type PlannedEvent = {
  id: string
  householdId: string
  owner: AccountOwner
  potCategory: PotCategory
  year: number
  name: string
  amount: number
  note: string | null
  createdAt: string
}

type State = {
  contributionChanges: ContributionChange[]
  plannedEvents: PlannedEvent[]
  loading: boolean
  error: string | null
}

export function usePlan(householdId: string | null) {
  const [state, setState] = useState<State>({
    contributionChanges: [],
    plannedEvents: [],
    loading: true,
    error: null,
  })

  const refetch = useCallback(async () => {
    if (!householdId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`/api/plan?householdId=${encodeURIComponent(householdId)}`)
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed to load plan')
      setState({
        contributionChanges: data.contributionChanges,
        plannedEvents: data.plannedEvents,
        loading: false,
        error: null,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'failed to load plan',
      }))
    }
  }, [householdId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const addContributionChange = useCallback(
    async (input: {
      owner: AccountOwner
      potCategory: PotCategory
      effectiveYear: number
      changeType: ContributionChangeType
      value: number
      note?: string
    }) => {
      await postJson('/api/plan', { householdId, kind: 'contribution_change', ...input })
      await refetch()
    },
    [householdId, refetch],
  )

  const removeContributionChange = useCallback(
    async (id: string) => {
      await sendDelete('/api/plan', { id, kind: 'contribution_change' })
      await refetch()
    },
    [refetch],
  )

  const addPlannedEvent = useCallback(
    async (input: { owner: AccountOwner; potCategory: PotCategory; year: number; name: string; amount: number; note?: string }) => {
      await postJson('/api/plan', { householdId, kind: 'planned_event', ...input })
      await refetch()
    },
    [householdId, refetch],
  )

  const removePlannedEvent = useCallback(
    async (id: string) => {
      await sendDelete('/api/plan', { id, kind: 'planned_event' })
      await refetch()
    },
    [refetch],
  )

  return {
    ...state,
    refetch,
    addContributionChange,
    removeContributionChange,
    addPlannedEvent,
    removePlannedEvent,
  }
}
