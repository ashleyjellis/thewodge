import { describe, expect, it } from 'vitest'
import { buildNewChildPlan, type NewChildInput } from './newChild'

const baseInput: NewChildInput = {
  owner: 'joint',
  potCategory: 'cash',
  normalMonthlyContribution: 300,
  monthlyCostReduction: 150,
  startYear: 2027,
  endYear: 2032,
}

describe('buildNewChildPlan', () => {
  it('emits exactly two contribution_changes rows and no planned_events', () => {
    const plan = buildNewChildPlan(baseInput)!
    expect(plan.contributionChanges).toHaveLength(2)
    expect(plan.plannedEvents).toHaveLength(0)
  })

  it('reduces at the start year by the stated amount, and restores the exact normal figure at the end year', () => {
    const plan = buildNewChildPlan(baseInput)!
    const [reduce, restore] = plan.contributionChanges

    expect(reduce!.effectiveYear).toBe(2027)
    expect(reduce!.changeType).toBe('set')
    expect(reduce!.value).toBe(150) // 300 - 150

    expect(restore!.effectiveYear).toBe(2032)
    expect(restore!.changeType).toBe('set')
    expect(restore!.value).toBe(300)
  })

  it('both rows apply to the same owner and pot', () => {
    const plan = buildNewChildPlan(baseInput)!
    for (const row of plan.contributionChanges) {
      expect(row.owner).toBe('joint')
      expect(row.potCategory).toBe('cash')
    }
  })

  it('clamps the reduced figure to zero rather than going negative, mirroring the engine clamp', () => {
    const plan = buildNewChildPlan({ ...baseInput, monthlyCostReduction: 500 })!
    expect(plan.contributionChanges[0]!.value).toBe(0)
    // the restore row is unaffected — it always goes back to the real normal figure
    expect(plan.contributionChanges[1]!.value).toBe(300)
  })

  it('returns null when the end year is at or before the start year', () => {
    expect(buildNewChildPlan({ ...baseInput, endYear: 2027 })).toBeNull()
    expect(buildNewChildPlan({ ...baseInput, endYear: 2026 })).toBeNull()
  })

  it('returns null when the reduction is not actually a reduction', () => {
    expect(buildNewChildPlan({ ...baseInput, monthlyCostReduction: 0 })).toBeNull()
    expect(buildNewChildPlan({ ...baseInput, monthlyCostReduction: -50 })).toBeNull()
  })

  it('summary names both years', () => {
    const plan = buildNewChildPlan(baseInput)!
    expect(plan.summary).toContain('2027')
    expect(plan.summary).toContain('2032')
  })
})
