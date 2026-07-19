/**
 * Contribution changes — the live Plan table's editable future-contribution
 * schedule. Unlike account_snapshots/forecast_snapshots, this is NOT
 * append-only: it's a working plan, not a historical record, so rows can be
 * updated or deleted freely.
 */
import { eq } from 'drizzle-orm'
import type { Db } from './client.js'
import { contributionChanges, type AccountOwner, type ContributionChangeType, type PotCategory } from './schema.js'

export type ContributionChangeRow = typeof contributionChanges.$inferSelect

export type NewContributionChange = {
  householdId: string
  owner: AccountOwner
  potCategory: PotCategory
  effectiveYear: number
  changeType: ContributionChangeType
  value: number
  note?: string | null
}

export async function listContributionChanges(
  db: Db,
  householdId: string,
): Promise<ContributionChangeRow[]> {
  return db
    .select()
    .from(contributionChanges)
    .where(eq(contributionChanges.householdId, householdId))
}

export async function createContributionChange(
  db: Db,
  input: NewContributionChange,
): Promise<ContributionChangeRow> {
  const row: ContributionChangeRow = {
    id: crypto.randomUUID(),
    householdId: input.householdId,
    owner: input.owner,
    potCategory: input.potCategory,
    effectiveYear: input.effectiveYear,
    changeType: input.changeType,
    value: input.value,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
  }
  await db.insert(contributionChanges).values(row)
  return row
}

export type ContributionChangePatch = Partial<
  Pick<NewContributionChange, 'effectiveYear' | 'changeType' | 'value' | 'note'>
>

export async function updateContributionChange(
  db: Db,
  id: string,
  patch: ContributionChangePatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return
  await db.update(contributionChanges).set(patch).where(eq(contributionChanges.id, id))
}

export async function deleteContributionChange(db: Db, id: string): Promise<void> {
  await db.delete(contributionChanges).where(eq(contributionChanges.id, id))
}
