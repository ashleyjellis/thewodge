/**
 * Turso/libSQL SnapshotStore (spec §8, §11) — the server-side option.
 *
 * Conforms to the exact same SnapshotStore interface as the local store, so the
 * calc engine and UI never change when you promote local → server. Scoped to one
 * authenticated user's household. Snapshots are append-only (insert only — no
 * update or delete is exposed).
 *
 * Server-only, and NOT wired into v1: financials stay local per the definition of
 * done. It is here to prove the swap is a change of implementation, nothing more.
 * The shared contract test (store/contract.ts) can target this once a test database
 * is provisioned.
 */
import { and, asc, eq } from 'drizzle-orm'
import type { Household, Snapshot } from '../calc/types'
import {
  makeSnapshot,
  type NewSnapshot,
  type SnapshotStore,
} from '../store/SnapshotStore'
import type { Db } from './db'
import { households, snapshots, users } from './schema'

export class TursoSnapshotStore implements SnapshotStore {
  constructor(
    private db: Db,
    private userId: string,
    private householdId: string,
  ) {}

  async loadHousehold(): Promise<Household | null> {
    const [row] = await this.db
      .select({ draftState: households.draftState })
      .from(households)
      .where(eq(households.id, this.householdId))
      .limit(1)
    return row?.draftState ?? null
  }

  async saveHousehold(household: Household): Promise<void> {
    await this.db
      .insert(households)
      .values({
        id: this.householdId,
        userId: this.userId,
        retirementAge: household.retirementAge,
        targetIncomeToday: household.targetIncomeToday,
        assumptions: household.assumptions,
        draftState: household,
      })
      .onConflictDoUpdate({
        target: households.id,
        set: {
          retirementAge: household.retirementAge,
          targetIncomeToday: household.targetIncomeToday,
          assumptions: household.assumptions,
          draftState: household,
        },
      })
  }

  async addSnapshot(input: NewSnapshot): Promise<Snapshot> {
    const snapshot = makeSnapshot(input)
    await this.db.insert(snapshots).values({
      id: snapshot.id,
      householdId: this.householdId,
      type: snapshot.type,
      state: snapshot.state,
      note: snapshot.note,
      timestamp: snapshot.timestamp,
    })
    if (input.type === 'baseline') {
      const [row] = await this.db
        .select({ baselineSnapshotId: households.baselineSnapshotId })
        .from(households)
        .where(eq(households.id, this.householdId))
        .limit(1)
      if (!row?.baselineSnapshotId) await this.setBaselineId(snapshot.id)
    }
    return snapshot
  }

  async listSnapshots(): Promise<Snapshot[]> {
    const rows = await this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.householdId, this.householdId))
      .orderBy(asc(snapshots.timestamp))
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      state: r.state,
      note: r.note,
    }))
  }

  async getBaselineId(): Promise<string | null> {
    const [row] = await this.db
      .select({ baselineSnapshotId: households.baselineSnapshotId })
      .from(households)
      .where(eq(households.id, this.householdId))
      .limit(1)
    return row?.baselineSnapshotId ?? null
  }

  async setBaselineId(id: string): Promise<void> {
    await this.db
      .update(households)
      .set({ baselineSnapshotId: id })
      .where(eq(households.id, this.householdId))
  }

  async getEmail(): Promise<string | null> {
    const [row] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, this.userId))
      .limit(1)
    return row?.email ?? null
  }

  async saveEmail(email: string): Promise<void> {
    await this.db
      .insert(users)
      .values({ id: this.userId, email })
      .onConflictDoUpdate({ target: users.id, set: { email } })
  }

  async clear(): Promise<void> {
    await this.db
      .delete(snapshots)
      .where(eq(snapshots.householdId, this.householdId))
    await this.db
      .update(households)
      .set({ draftState: null, baselineSnapshotId: null })
      .where(
        and(
          eq(households.id, this.householdId),
          eq(households.userId, this.userId),
        ),
      )
  }
}
