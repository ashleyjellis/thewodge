/**
 * Shared vocabulary for the typed life-event compilers (maternityLeave.ts,
 * houseMove.ts, newChild.ts) — each one is purely a function from typed
 * input to a LifeEventPlan, a draft set of rows onto the two existing
 * live-plan primitives (contribution_changes, planned_events). Zero engine
 * changes anywhere in this family: PlanUpdatePreview renders a LifeEventPlan
 * generically, with no idea which compiler produced it, and the confirm step
 * just posts each draft row through usePlan.ts's existing
 * addContributionChange/addPlannedEvent exactly as any other form would.
 */
import type { AccountOwner } from '../accountOwner.js'
import type { PotCategory } from '../householdForecast.js'
import type { ContributionChangeType } from '../scheduledPlan.js'

export type LifeEventKind = 'maternity_paternity_leave' | 'house_move' | 'new_child'

export type ContributionChangeDraft = {
  owner: AccountOwner
  potCategory: PotCategory
  effectiveYear: number
  changeType: ContributionChangeType
  value: number
  note: string
}

export type PlannedEventDraft = {
  owner: AccountOwner
  potCategory: PotCategory
  year: number
  name: string
  amount: number
  note: string
}

export type LifeEventPlan = {
  /** short human summary shown at the top of the preview, e.g. "Maternity
   *  leave — Sam, 2027 to 2028" */
  summary: string
  contributionChanges: ContributionChangeDraft[]
  plannedEvents: PlannedEventDraft[]
}
