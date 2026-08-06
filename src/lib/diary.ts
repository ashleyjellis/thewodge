/**
 * Merges the household's three note sources — balance-update notes
 * (account_snapshots), contribution/event notes (contribution_changes,
 * planned_events), and checkpoint labels (forecast_snapshots) — into one
 * chronologically-sorted log for FinancialDiary.tsx. Pure, no IO: each
 * source already has its own fetch hook (useSnapshots, usePlan,
 * useCheckpoints); this only combines what they return.
 *
 * Deliberately returns structured entries (owner/potCategory/accountId),
 * not pre-formatted strings — presentation (account provider lookup, owner/
 * pot labels) stays the component's job, same split as the rest of this
 * app's lib/ vs components/app/ boundary.
 */
import type { AccountOwner } from './accountOwner.js'
import type { PotCategory } from './householdForecast.js'

export type DiaryEntry =
  | { kind: 'balance_update'; id: string; at: string; note: string; accountId: string }
  | { kind: 'contribution_change'; id: string; at: string; note: string; owner: AccountOwner; potCategory: PotCategory }
  | {
      kind: 'planned_event'
      id: string
      at: string
      note: string
      owner: AccountOwner
      potCategory: PotCategory
      name: string
    }
  | { kind: 'checkpoint'; id: string; at: string; note: string }

function withNote<T extends { note: string | null }>(rows: T[]): (T & { note: string })[] {
  return rows.filter((r): r is T & { note: string } => Boolean(r.note))
}

/** Newest first, matching this app's existing diary/timeline precedent
 *  (GrowthDiary.tsx, CheckpointTimeline.tsx). */
export function buildFinancialDiary(params: {
  snapshots: { id: string; recordedAt: string; note: string | null; accountId: string }[]
  contributionChanges: {
    id: string
    createdAt: string
    note: string | null
    owner: AccountOwner
    potCategory: PotCategory
  }[]
  plannedEvents: {
    id: string
    createdAt: string
    note: string | null
    owner: AccountOwner
    potCategory: PotCategory
    name: string
  }[]
  checkpoints: { id: string; createdAt: string; note: string | null; type: 'baseline' | 'replan' | 'checkpoint' }[]
}): DiaryEntry[] {
  const entries: DiaryEntry[] = [
    ...withNote(params.snapshots).map((s) => ({
      kind: 'balance_update' as const,
      id: `balance-${s.id}`,
      at: s.recordedAt,
      note: s.note,
      accountId: s.accountId,
    })),
    ...withNote(params.contributionChanges).map((c) => ({
      kind: 'contribution_change' as const,
      id: `contribution-${c.id}`,
      at: c.createdAt,
      note: c.note,
      owner: c.owner,
      potCategory: c.potCategory,
    })),
    ...withNote(params.plannedEvents).map((e) => ({
      kind: 'planned_event' as const,
      id: `event-${e.id}`,
      at: e.createdAt,
      note: e.note,
      owner: e.owner,
      potCategory: e.potCategory,
      name: e.name,
    })),
    ...withNote(params.checkpoints.filter((cp) => cp.type === 'checkpoint')).map((cp) => ({
      kind: 'checkpoint' as const,
      id: `checkpoint-${cp.id}`,
      at: cp.createdAt,
      note: cp.note,
    })),
  ]

  return entries.sort((a, b) => b.at.localeCompare(a.at))
}
