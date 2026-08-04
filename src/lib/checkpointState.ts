/**
 * A checkpoint's frozen state: the same FrozenForecastState every snapshot
 * already stores (pot totals + rates), plus the live contribution_changes/
 * planned_events schedule at save time — an additive superset, so a later
 * variance display can replay exactly what was scheduled rather than
 * assuming a flat monthly figure forever (see scheduledPlan.ts's
 * buildScheduledForecastYearRows). isValidFrozenState (unchanged) still
 * reads these rows correctly since it only checks fields it already
 * expects; a row from before this shipped, or a baseline/replan (which
 * never carries a schedule at all), simply has nothing to replay —
 * checkpointSchedule degrades that to [], not an invalidation.
 */
import { isValidFrozenState, type FrozenForecastState } from './householdForecast.js'
import type { OwnerScopedContributionChange, OwnerScopedPlannedEvent } from './scheduledPlan.js'

export type CheckpointState = FrozenForecastState & {
  contributionChanges: OwnerScopedContributionChange[]
  plannedEvents: OwnerScopedPlannedEvent[]
}

function isContributionChange(v: unknown): v is OwnerScopedContributionChange {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return (
    typeof c.owner === 'string' &&
    typeof c.potCategory === 'string' &&
    typeof c.effectiveYear === 'number' &&
    typeof c.changeType === 'string' &&
    typeof c.value === 'number'
  )
}

function isPlannedEvent(v: unknown): v is OwnerScopedPlannedEvent {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return (
    typeof e.owner === 'string' &&
    typeof e.potCategory === 'string' &&
    typeof e.year === 'number' &&
    typeof e.amount === 'number'
  )
}

/** Builds the JSON-ready checkpoint state from a live schedule read at save time. */
export function buildCheckpointState(
  frozen: FrozenForecastState,
  contributionChanges: OwnerScopedContributionChange[],
  plannedEvents: OwnerScopedPlannedEvent[],
): CheckpointState {
  return { ...frozen, contributionChanges, plannedEvents }
}

/**
 * Reads a checkpoint's frozen schedule back out of a parsed snapshot JSON —
 * [] for anything that isn't a valid frozen state, or is one but predates
 * this shipping (baseline/replan rows never carry a schedule; an older
 * checkpoint row might not either). Never throws.
 */
export function checkpointSchedule(value: unknown): {
  contributionChanges: OwnerScopedContributionChange[]
  plannedEvents: OwnerScopedPlannedEvent[]
} {
  if (!isValidFrozenState(value)) return { contributionChanges: [], plannedEvents: [] }
  const v = value as Record<string, unknown>
  return {
    contributionChanges: Array.isArray(v.contributionChanges)
      ? v.contributionChanges.filter(isContributionChange)
      : [],
    plannedEvents: Array.isArray(v.plannedEvents) ? v.plannedEvents.filter(isPlannedEvent) : [],
  }
}
