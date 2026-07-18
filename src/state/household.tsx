/**
 * Household state (ring 3 plumbing) — the single source of the working Household
 * for every screen. Loads from the SnapshotStore, seeds when empty, persists edits,
 * and live-recalculates the whole analysis through the pure engine (spec §4, §6).
 *
 * It reads from the store and calls the engine — it never touches a DB client or
 * does maths itself (ring boundaries, §11).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Household, Person, Snapshot } from '@/lib/calc/types'
import { analyseHousehold, type HouseholdAnalysis } from '@/lib/calc/household'
import { SAMPLE_HOUSEHOLD } from '@/lib/sampleHousehold'
import {
  actualSnapshots,
  currentBaseline,
  getStore,
  type SnapshotStore,
} from '@/lib/store'

type HouseholdContextValue = {
  household: Household
  analysis: HouseholdAnalysis
  baseYear: number
  ready: boolean
  setHousehold: (next: Household) => void
  updatePerson: (index: number, patch: Partial<Person>) => void
  updateAssumptions: (patch: Partial<Household['assumptions']>) => void
  reset: () => void
  snapshots: Snapshot[]
  actuals: Snapshot[]
  baseline: Snapshot | null
  saveBaseline: (note: string) => Promise<void>
  addActual: (note: string) => Promise<void>
  replan: (note: string) => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [store] = useState<SnapshotStore>(() => getStore())
  // seed deterministically for SSR + first hydration; real data loads post-mount.
  const [household, setHouseholdState] = useState<Household>(SAMPLE_HOUSEHOLD)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [baseline, setBaseline] = useState<Snapshot | null>(null)
  const [ready, setReady] = useState(false)

  const baseYear = useMemo(() => new Date().getFullYear(), [])

  const refreshSnapshots = useCallback(async () => {
    const [all, base] = await Promise.all([
      store.listSnapshots(),
      currentBaseline(store),
    ])
    setSnapshots(all)
    setBaseline(base)
  }, [store])

  // load persisted state on the client; seed the store on first visit.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const stored = await store.loadHousehold()
      if (cancelled) return
      if (stored) {
        setHouseholdState(stored)
      } else {
        await store.saveHousehold(SAMPLE_HOUSEHOLD)
      }
      await refreshSnapshots()
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [store, refreshSnapshots])

  const setHousehold = useCallback(
    (next: Household) => {
      setHouseholdState(next)
      void store.saveHousehold(next)
    },
    [store],
  )

  const updatePerson = useCallback(
    (index: number, patch: Partial<Person>) => {
      setHouseholdState((prev) => {
        const people = prev.people.map((p, i) =>
          i === index ? { ...p, ...patch } : p,
        ) as Household['people']
        const next = { ...prev, people }
        void store.saveHousehold(next)
        return next
      })
    },
    [store],
  )

  const updateAssumptions = useCallback(
    (patch: Partial<Household['assumptions']>) => {
      setHouseholdState((prev) => {
        const next = { ...prev, assumptions: { ...prev.assumptions, ...patch } }
        void store.saveHousehold(next)
        return next
      })
    },
    [store],
  )

  const reset = useCallback(() => {
    setHousehold(SAMPLE_HOUSEHOLD)
  }, [setHousehold])

  const saveBaseline = useCallback(
    async (note: string) => {
      await store.saveHousehold(household)
      await store.addSnapshot({ type: 'baseline', state: household, note })
      await refreshSnapshots()
    },
    [store, household, refreshSnapshots],
  )

  const addActual = useCallback(
    async (note: string) => {
      await store.saveHousehold(household)
      await store.addSnapshot({ type: 'actual', state: household, note })
      await refreshSnapshots()
    },
    [store, household, refreshSnapshots],
  )

  // a deliberate re-baseline: add a new baseline and move the pointer to it. The
  // old baseline stays in the list, shown later as a faded fork (§5).
  const replan = useCallback(
    async (note: string) => {
      const snap = await store.addSnapshot({
        type: 'baseline',
        state: household,
        note,
      })
      await store.setBaselineId(snap.id)
      await refreshSnapshots()
    },
    [store, household, refreshSnapshots],
  )

  const analysis = useMemo(
    () => analyseHousehold(household, { baseYear }),
    [household, baseYear],
  )

  const value: HouseholdContextValue = {
    household,
    analysis,
    baseYear,
    ready,
    setHousehold,
    updatePerson,
    updateAssumptions,
    reset,
    snapshots,
    actuals: useMemo(
      () => snapshots.filter((s) => s.type === 'actual'),
      [snapshots],
    ),
    baseline,
    saveBaseline,
    addActual,
    replan,
  }

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext)
  if (!ctx) {
    throw new Error('useHousehold must be used within a HouseholdProvider')
  }
  return ctx
}

// re-export for screens that only need the async helper shape
export { actualSnapshots }
