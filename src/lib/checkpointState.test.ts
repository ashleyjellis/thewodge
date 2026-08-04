import { describe, expect, it } from 'vitest'
import { buildCheckpointState, checkpointSchedule, type CheckpointState } from './checkpointState'
import type { FrozenForecastState } from './householdForecast'
import type { OwnerScopedContributionChange, OwnerScopedPlannedEvent } from './scheduledPlan'

const frozen: FrozenForecastState = {
  investedRate: 0.07,
  cashRate: 0.045,
  total: {
    age: 36,
    targetAge: 60,
    pension: 20_000,
    stocks: 5_000,
    cash: 2_000,
    monthly: 200,
    pensionMonthly: 500,
    cashMonthly: 50,
  },
  personA: null,
  personB: null,
  joint: {
    age: 36,
    targetAge: 60,
    pension: 0,
    stocks: 0,
    cash: 0,
    monthly: 0,
    pensionMonthly: 0,
    cashMonthly: 0,
  },
}

describe('buildCheckpointState', () => {
  it('is an additive superset of the frozen state', () => {
    const changes: OwnerScopedContributionChange[] = [
      { owner: 'person_a', potCategory: 'pension', effectiveYear: 2028, changeType: 'set', value: 800 },
    ]
    const events: OwnerScopedPlannedEvent[] = [{ owner: 'joint', potCategory: 'cash', year: 2027, amount: -5_000 }]
    const state = buildCheckpointState(frozen, changes, events)
    expect(state.investedRate).toBe(0.07)
    expect(state.total.pension).toBe(20_000)
    expect(state.contributionChanges).toEqual(changes)
    expect(state.plannedEvents).toEqual(events)
  })
})

describe('checkpointSchedule', () => {
  it('reads the schedule back out of a valid checkpoint state', () => {
    const changes: OwnerScopedContributionChange[] = [
      { owner: 'person_a', potCategory: 'pension', effectiveYear: 2028, changeType: 'set', value: 800 },
    ]
    const state: CheckpointState = buildCheckpointState(frozen, changes, [])
    const result = checkpointSchedule(JSON.parse(JSON.stringify(state)))
    expect(result.contributionChanges).toEqual(changes)
    expect(result.plannedEvents).toEqual([])
  })

  it('degrades a plain FrozenForecastState (a baseline/replan, which never carries a schedule) to empty arrays', () => {
    const result = checkpointSchedule(JSON.parse(JSON.stringify(frozen)))
    expect(result).toEqual({ contributionChanges: [], plannedEvents: [] })
  })

  it('degrades an invalid/garbage value to empty arrays rather than throwing', () => {
    expect(checkpointSchedule(null)).toEqual({ contributionChanges: [], plannedEvents: [] })
    expect(checkpointSchedule({ not: 'a frozen state' })).toEqual({ contributionChanges: [], plannedEvents: [] })
    expect(checkpointSchedule('garbage')).toEqual({ contributionChanges: [], plannedEvents: [] })
  })

  it('filters out malformed entries within an otherwise-valid schedule array', () => {
    const state = {
      ...frozen,
      contributionChanges: [
        { owner: 'person_a', potCategory: 'pension', effectiveYear: 2028, changeType: 'set', value: 800 },
        { owner: 'person_a', potCategory: 'pension' }, // missing required fields
        'garbage',
      ],
      plannedEvents: [{ owner: 'joint', potCategory: 'cash', year: 2027, amount: -5_000 }, null],
    }
    const result = checkpointSchedule(state)
    expect(result.contributionChanges).toHaveLength(1)
    expect(result.plannedEvents).toHaveLength(1)
  })
})
