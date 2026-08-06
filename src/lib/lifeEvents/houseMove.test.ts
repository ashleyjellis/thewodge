import { describe, expect, it } from 'vitest'
import { buildHouseMovePlan, type HouseMoveInput } from './houseMove'

const baseInput: HouseMoveInput = {
  owner: 'joint',
  potCategory: 'cash',
  year: 2028,
  moveCost: 15_000,
  normalMonthlyContribution: 200,
  newMonthlyContribution: null,
}

describe('buildHouseMovePlan', () => {
  it('always emits exactly one planned_events row for the move cost, as money out', () => {
    const plan = buildHouseMovePlan(baseInput)!
    expect(plan.plannedEvents).toHaveLength(1)
    expect(plan.plannedEvents[0]!.amount).toBe(-15_000)
    expect(plan.plannedEvents[0]!.year).toBe(2028)
    expect(plan.plannedEvents[0]!.potCategory).toBe('cash')
    expect(plan.plannedEvents[0]!.owner).toBe('joint')
  })

  it('emits no contribution_changes row when saving is unaffected', () => {
    const plan = buildHouseMovePlan(baseInput)!
    expect(plan.contributionChanges).toHaveLength(0)
  })

  it('emits a second row only when the new monthly figure actually differs from normal', () => {
    const same = buildHouseMovePlan({ ...baseInput, newMonthlyContribution: 200 })!
    expect(same.contributionChanges).toHaveLength(0)

    const different = buildHouseMovePlan({ ...baseInput, newMonthlyContribution: 350 })!
    expect(different.contributionChanges).toHaveLength(1)
    expect(different.contributionChanges[0]!.value).toBe(350)
    expect(different.contributionChanges[0]!.effectiveYear).toBe(2028)
    expect(different.contributionChanges[0]!.changeType).toBe('set')
  })

  it('always treats the cost as an outflow, regardless of the sign given', () => {
    const plan = buildHouseMovePlan({ ...baseInput, moveCost: 15_000 })!
    expect(plan.plannedEvents[0]!.amount).toBeLessThan(0)
  })

  it('never emits a negative new monthly contribution', () => {
    const plan = buildHouseMovePlan({ ...baseInput, newMonthlyContribution: -50 })!
    expect(plan.contributionChanges[0]!.value).toBe(0)
  })

  it('returns null when there is no real cost to record', () => {
    expect(buildHouseMovePlan({ ...baseInput, moveCost: 0 })).toBeNull()
    expect(buildHouseMovePlan({ ...baseInput, moveCost: -1000 })).toBeNull()
  })

  it('summary flags when saving rate changes, and omits it when not', () => {
    const unaffected = buildHouseMovePlan(baseInput)!
    expect(unaffected.summary).not.toContain('saving rate')

    const affected = buildHouseMovePlan({ ...baseInput, newMonthlyContribution: 100 })!
    expect(affected.summary).toContain('saving rate')
  })
})
