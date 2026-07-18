/**
 * The shared SnapshotStore contract (spec §11).
 *
 * One suite, run against every implementation, so they are provably interchangeable
 * — the guarantee that makes the local ⇄ Turso swap safe. Import and call this from
 * a test file per implementation.
 */
import { expect, describe, it, beforeEach } from 'vitest'
import type { Household } from '../calc/types'
import { SAMPLE_HOUSEHOLD } from '../sampleHousehold'
import {
  actualSnapshots,
  currentBaseline,
  type SnapshotStore,
} from './SnapshotStore'

export function runSnapshotStoreContract(
  name: string,
  makeStore: () => SnapshotStore,
): void {
  describe(`SnapshotStore contract — ${name}`, () => {
    let store: SnapshotStore
    beforeEach(async () => {
      store = makeStore()
      await store.clear()
    })

    it('round-trips the working household', async () => {
      expect(await store.loadHousehold()).toBeNull()
      await store.saveHousehold(SAMPLE_HOUSEHOLD)
      const loaded = await store.loadHousehold()
      expect(loaded?.targetIncomeToday).toBe(70_000)
      expect(loaded?.people).toHaveLength(2)
    })

    it('stores the household by value, not by reference', async () => {
      const draft: Household = structuredClone(SAMPLE_HOUSEHOLD)
      await store.saveHousehold(draft)
      draft.targetIncomeToday = 1 // mutate after saving
      const loaded = await store.loadHousehold()
      expect(loaded?.targetIncomeToday).toBe(70_000)
    })

    it('appends snapshots oldest-first with ids and timestamps', async () => {
      const a = await store.addSnapshot({
        type: 'baseline',
        state: SAMPLE_HOUSEHOLD,
        note: 'first plan',
      })
      const b = await store.addSnapshot({
        type: 'actual',
        state: SAMPLE_HOUSEHOLD,
        note: 'bonus invested',
      })
      expect(a.id).toBeTruthy()
      expect(a.timestamp).toBeTruthy()
      expect(a.id).not.toBe(b.id)

      const all = await store.listSnapshots()
      expect(all.map((s) => s.note)).toEqual(['first plan', 'bonus invested'])
    })

    it('keeps snapshots immutable after they are stored', async () => {
      const draft: Household = structuredClone(SAMPLE_HOUSEHOLD)
      await store.addSnapshot({ type: 'actual', state: draft, note: 'x' })
      draft.people[0].pension.value = -999 // mutate the source afterwards
      const [snap] = await store.listSnapshots()
      expect(snap!.state.people[0].pension.value).toBe(145_000)
    })

    it('auto-flags the first baseline as plan-of-record', async () => {
      const base = await store.addSnapshot({
        type: 'baseline',
        state: SAMPLE_HOUSEHOLD,
        note: 'baseline',
      })
      expect(await store.getBaselineId()).toBe(base.id)
      expect((await currentBaseline(store))?.id).toBe(base.id)
    })

    it('moves the baseline only when told to (deliberate replan)', async () => {
      const first = await store.addSnapshot({
        type: 'baseline',
        state: SAMPLE_HOUSEHOLD,
        note: 'v1',
      })
      // adding actuals must NOT move the baseline
      await store.addSnapshot({
        type: 'actual',
        state: SAMPLE_HOUSEHOLD,
        note: 'update',
      })
      expect(await store.getBaselineId()).toBe(first.id)

      const replan = await store.addSnapshot({
        type: 'baseline',
        state: SAMPLE_HOUSEHOLD,
        note: 'v2',
      })
      await store.setBaselineId(replan.id)
      expect((await currentBaseline(store))?.id).toBe(replan.id)
    })

    it('separates actuals from baselines', async () => {
      await store.addSnapshot({
        type: 'baseline',
        state: SAMPLE_HOUSEHOLD,
        note: 'b',
      })
      await store.addSnapshot({
        type: 'actual',
        state: SAMPLE_HOUSEHOLD,
        note: 'a1',
      })
      await store.addSnapshot({
        type: 'actual',
        state: SAMPLE_HOUSEHOLD,
        note: 'a2',
      })
      const actuals = await actualSnapshots(store)
      expect(actuals.map((s) => s.note)).toEqual(['a1', 'a2'])
    })

    it('round-trips the email', async () => {
      expect(await store.getEmail()).toBeNull()
      await store.saveEmail('ashley@example.com')
      expect(await store.getEmail()).toBe('ashley@example.com')
    })

    it('clears everything', async () => {
      await store.saveHousehold(SAMPLE_HOUSEHOLD)
      await store.addSnapshot({
        type: 'baseline',
        state: SAMPLE_HOUSEHOLD,
        note: 'b',
      })
      await store.saveEmail('x@y.com')
      await store.clear()
      expect(await store.loadHousehold()).toBeNull()
      expect(await store.listSnapshots()).toEqual([])
      expect(await store.getBaselineId()).toBeNull()
      expect(await store.getEmail()).toBeNull()
    })
  })
}
