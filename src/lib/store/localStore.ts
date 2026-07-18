/**
 * Local-first SnapshotStore — financials stay on the device (spec §8).
 *
 * Backed by a tiny synchronous key-value port (the shape of `localStorage`), so the
 * same code runs against the browser's localStorage in production and an in-memory
 * KV in tests. Nothing here reaches the network; financial data never leaves the
 * client. Promoting to server-side (Turso) is a swap of the whole store, not this
 * file's internals.
 */
import type { Household, Snapshot } from '../calc/types'
import {
  deepClone,
  makeSnapshot,
  type NewSnapshot,
  type SnapshotStore,
} from './SnapshotStore'

/** The subset of the Web Storage API we use. */
export interface KeyValue {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** A dependency-free KV for tests / non-browser environments. */
export class MemoryKeyValue implements KeyValue {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

const NS = 'wodge.v1'
const KEYS = {
  household: `${NS}.household`,
  snapshots: `${NS}.snapshots`,
  baselineId: `${NS}.baselineId`,
  email: `${NS}.email`,
}

export class LocalSnapshotStore implements SnapshotStore {
  constructor(private kv: KeyValue) {}

  private read<T>(key: string): T | null {
    const raw = this.kv.getItem(key)
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  private write(key: string, value: unknown): void {
    this.kv.setItem(key, JSON.stringify(value))
  }

  async loadHousehold(): Promise<Household | null> {
    return this.read<Household>(KEYS.household)
  }

  async saveHousehold(household: Household): Promise<void> {
    this.write(KEYS.household, household)
  }

  async addSnapshot(input: NewSnapshot): Promise<Snapshot> {
    const snapshot = makeSnapshot(input)
    const snapshots = this.read<Snapshot[]>(KEYS.snapshots) ?? []
    snapshots.push(snapshot)
    this.write(KEYS.snapshots, snapshots)
    if (input.type === 'baseline' && this.kv.getItem(KEYS.baselineId) === null) {
      this.write(KEYS.baselineId, snapshot.id)
    }
    return deepClone(snapshot)
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return this.read<Snapshot[]>(KEYS.snapshots) ?? []
  }

  async getBaselineId(): Promise<string | null> {
    return this.read<string>(KEYS.baselineId)
  }

  async setBaselineId(id: string): Promise<void> {
    this.write(KEYS.baselineId, id)
  }

  async getEmail(): Promise<string | null> {
    return this.read<string>(KEYS.email)
  }

  async saveEmail(email: string): Promise<void> {
    this.write(KEYS.email, email)
  }

  async clear(): Promise<void> {
    for (const key of Object.values(KEYS)) this.kv.removeItem(key)
  }
}

/**
 * Browser factory: localStorage-backed store, with a memory fallback on the server
 * (SSR) where no window exists.
 */
export function createLocalStore(): SnapshotStore {
  if (typeof window !== 'undefined' && window.localStorage) {
    return new LocalSnapshotStore(window.localStorage)
  }
  return new LocalSnapshotStore(new MemoryKeyValue())
}
