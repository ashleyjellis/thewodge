/**
 * In-memory SnapshotStore — for SSR, tests, and as the reference implementation
 * the contract test pins. Holds nothing across a reload.
 */
import type { Household, Snapshot } from '../calc/types'
import {
  deepClone,
  makeSnapshot,
  type NewSnapshot,
  type SnapshotStore,
} from './SnapshotStore'

export class MemorySnapshotStore implements SnapshotStore {
  private household: Household | null = null
  private snapshots: Snapshot[] = []
  private baselineId: string | null = null
  private email: string | null = null

  async loadHousehold(): Promise<Household | null> {
    return this.household ? deepClone(this.household) : null
  }

  async saveHousehold(household: Household): Promise<void> {
    this.household = deepClone(household)
  }

  async addSnapshot(input: NewSnapshot): Promise<Snapshot> {
    const snapshot = makeSnapshot(input)
    this.snapshots.push(snapshot)
    // the first baseline becomes the plan-of-record automatically.
    if (input.type === 'baseline' && this.baselineId === null) {
      this.baselineId = snapshot.id
    }
    return deepClone(snapshot)
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return this.snapshots.map((s) => deepClone(s))
  }

  async getBaselineId(): Promise<string | null> {
    return this.baselineId
  }

  async setBaselineId(id: string): Promise<void> {
    this.baselineId = id
  }

  async getEmail(): Promise<string | null> {
    return this.email
  }

  async saveEmail(email: string): Promise<void> {
    this.email = email
  }

  async clear(): Promise<void> {
    this.household = null
    this.snapshots = []
    this.baselineId = null
    this.email = null
  }
}
