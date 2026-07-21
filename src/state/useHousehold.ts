/**
 * Fetches (and get-or-creates) the one household + its people, via /api/household.
 * No auth yet — see src/server/db/households.ts. Every /app/* route that needs
 * household context uses this rather than fetching independently.
 *
 * Deliberately does not import types from src/server/db/* — client code stays
 * decoupled from the server ring even at the type level; the shapes below mirror
 * the API's JSON response.
 */
import { useCallback, useEffect, useState } from 'react'

export type Household = {
  id: string
  createdAt: string
  retirementAge: number
  targetIncomeToday: number | null
  realReturn: number
  cashReturn: number
  swr: number
}

export type HouseholdPerson = {
  id: string
  householdId: string
  name: string
  age: number
  retirementAge: number
  salary: number | null
  salaryGrowthPct: number | null
  bonus: number | null
  employerPensionUserPct: number | null
  employerPensionMatchPct: number | null
  employerPensionAdditionalPct: number | null
}

type State = {
  household: Household | null
  people: HouseholdPerson[]
  loading: boolean
  error: string | null
}

export function useHousehold() {
  const [state, setState] = useState<State>({
    household: null,
    people: [],
    loading: true,
    error: null,
  })

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/household')
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed to load household')
      setState({ household: data.household, people: data.people, loading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'failed to load household',
      }))
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { ...state, refetch }
}
