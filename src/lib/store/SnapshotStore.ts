/**
 * SnapshotStore — the storage abstraction (spec §8, §11, ring 2).
 *
 * The ONLY thing that touches persistence. Financial data never reaches the calc
 * engine or the UI through any other path. Swapping local ⇄ server (Turso) is a
 * change of implementation behind this interface — nothing else moves.
 *
 * Snapshots are APPEND-ONLY and IMMUTABLE (spec §2, §5): the interface exposes no
 * update or delete for them. The baseline is simply the snapshot the pointer flags
 * as plan-of-record; "replan" moves that pointer deliberately — it never mutates a
 * snapshot. Actuals are added freely; the baseline only moves when the user says so.
 */
import type { Household, Snapshot, SnapshotType } from '../calc/types'

export type NewSnapshot = {
  type: SnapshotType
  state: Household
  note: string
}

export interface SnapshotStore {
  /** the live-edited working household (survives reload). null if none yet. */
  loadHousehold(): Promise<Household | null>
  saveHousehold(household: Household): Promise<void>

  /** append an immutable snapshot; returns the stored copy. */
  addSnapshot(input: NewSnapshot): Promise<Snapshot>
  /** all snapshots, oldest first. */
  listSnapshots(): Promise<Snapshot[]>

  /** id of the plan-of-record snapshot (null if none). */
  getBaselineId(): Promise<string | null>
  /** deliberately set the plan-of-record (re-baseline / replan). */
  setBaselineId(id: string): Promise<void>

  /** the email captured at the signup wall (the asset — server-side in a real deploy). */
  getEmail(): Promise<string | null>
  saveEmail(email: string): Promise<void>

  /** wipe everything (sign-out / tests). */
  clear(): Promise<void>
}

/** Build an immutable snapshot with a deep-copied Household state. */
export function makeSnapshot(
  input: NewSnapshot,
  meta?: { id?: string; timestamp?: string },
): Snapshot {
  return {
    id: meta?.id ?? newId(),
    timestamp: meta?.timestamp ?? new Date().toISOString(),
    type: input.type,
    state: deepClone(input.state),
    note: input.note,
  }
}

/**
 * The current baseline snapshot: the one the pointer flags, else the latest
 * snapshot of type "baseline", else null.
 */
export async function currentBaseline(
  store: SnapshotStore,
): Promise<Snapshot | null> {
  const [snapshots, baselineId] = await Promise.all([
    store.listSnapshots(),
    store.getBaselineId(),
  ])
  if (baselineId) {
    const found = snapshots.find((s) => s.id === baselineId)
    if (found) return found
  }
  const baselines = snapshots.filter((s) => s.type === 'baseline')
  return baselines.length > 0 ? baselines[baselines.length - 1]! : null
}

/** Every "actual" snapshot, oldest first. */
export async function actualSnapshots(
  store: SnapshotStore,
): Promise<Snapshot[]> {
  const snapshots = await store.listSnapshots()
  return snapshots.filter((s) => s.type === 'actual')
}

export function deepClone<T>(value: T): T {
  // structuredClone is available in Node 18+ and all modern browsers.
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function newId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID()
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
