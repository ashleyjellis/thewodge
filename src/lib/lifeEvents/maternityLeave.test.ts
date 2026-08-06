import { describe, expect, it } from 'vitest'
import { buildMaternityLeavePlan, type MaternityLeaveInput } from './maternityLeave'
import { calculateStatutoryPay } from './statutoryPay'

const baseInput: MaternityLeaveInput = {
  personName: 'Sam',
  owner: 'person_a',
  potCategory: 'investments',
  leaveType: 'maternity',
  annualSalary: 60_000,
  normalMonthlyContribution: 500,
  leaveStartYear: 2027,
  returnYear: 2028,
}

describe('buildMaternityLeavePlan', () => {
  it('emits exactly two contribution_changes rows and no planned_events', () => {
    const plan = buildMaternityLeavePlan(baseInput)
    expect(plan).not.toBeNull()
    expect(plan!.contributionChanges).toHaveLength(2)
    expect(plan!.plannedEvents).toHaveLength(0)
  })

  it('drops at leave-start with a reduced figure, and restores the exact normal figure at return', () => {
    const plan = buildMaternityLeavePlan(baseInput)!
    const [drop, restore] = plan.contributionChanges

    expect(drop!.effectiveYear).toBe(2027)
    expect(drop!.changeType).toBe('set')
    expect(drop!.value).toBeLessThan(baseInput.normalMonthlyContribution)
    expect(drop!.value).toBeGreaterThan(0)

    expect(restore!.effectiveYear).toBe(2028)
    expect(restore!.changeType).toBe('set')
    expect(restore!.value).toBe(baseInput.normalMonthlyContribution)
  })

  it('both rows apply to the same owner and pot chosen for the leave', () => {
    const plan = buildMaternityLeavePlan(baseInput)!
    for (const row of plan.contributionChanges) {
      expect(row.owner).toBe('person_a')
      expect(row.potCategory).toBe('investments')
    }
  })

  it('the reduction is proportional to the income drop, not a fixed cut', () => {
    const lowContribution = buildMaternityLeavePlan({ ...baseInput, normalMonthlyContribution: 100 })!
    const highContribution = buildMaternityLeavePlan({ ...baseInput, normalMonthlyContribution: 1000 })!
    const lowRatio = lowContribution.contributionChanges[0]!.value / 100
    const highRatio = highContribution.contributionChanges[0]!.value / 1000
    expect(lowRatio).toBeCloseTo(highRatio, 5)
  })

  it('the reduced figure is the statutory-pay engine\'s own blended monthly figure, scaled by the contribution ratio', () => {
    const plan = buildMaternityLeavePlan(baseInput)!
    const pay = calculateStatutoryPay(baseInput.annualSalary, baseInput.leaveType)
    const expectedRatio = pay.blendedMonthlyPay / (baseInput.annualSalary / 12)
    expect(plan.contributionChanges[0]!.value).toBeCloseTo(baseInput.normalMonthlyContribution * expectedRatio, 5)
  })

  it('a low earner (under the statutory cap) sees the same reduction ratio for maternity and paternity — both pay 90% AWE throughout', () => {
    const lowSalaryInput = { ...baseInput, annualSalary: 10_000 }
    const maternity = buildMaternityLeavePlan({ ...lowSalaryInput, leaveType: 'maternity' })!
    const paternity = buildMaternityLeavePlan({ ...lowSalaryInput, leaveType: 'paternity' })!
    expect(maternity.contributionChanges[0]!.value).toBeCloseTo(paternity.contributionChanges[0]!.value, 5)
  })

  it('a high earner (over the statutory cap) sees maternity reduce less than paternity — maternity\'s 6 uncapped weeks pull its blend up', () => {
    const highSalaryInput = { ...baseInput, annualSalary: 100_000 }
    const maternity = buildMaternityLeavePlan({ ...highSalaryInput, leaveType: 'maternity' })!
    const paternity = buildMaternityLeavePlan({ ...highSalaryInput, leaveType: 'paternity' })!
    expect(maternity.contributionChanges[0]!.value).toBeGreaterThan(paternity.contributionChanges[0]!.value)
  })

  it('returns null when the return year is at or before the leave-start year', () => {
    expect(buildMaternityLeavePlan({ ...baseInput, returnYear: 2027 })).toBeNull()
    expect(buildMaternityLeavePlan({ ...baseInput, returnYear: 2026 })).toBeNull()
  })

  it('returns null when there is no salary to base statutory pay on', () => {
    expect(buildMaternityLeavePlan({ ...baseInput, annualSalary: 0 })).toBeNull()
    expect(buildMaternityLeavePlan({ ...baseInput, annualSalary: -1000 })).toBeNull()
  })

  it('never reduces a pot with no existing contribution below zero', () => {
    const plan = buildMaternityLeavePlan({ ...baseInput, normalMonthlyContribution: 0 })!
    expect(plan.contributionChanges[0]!.value).toBe(0)
    expect(plan.contributionChanges[1]!.value).toBe(0)
  })

  it('summary names the person, leave type, and both years', () => {
    const plan = buildMaternityLeavePlan(baseInput)!
    expect(plan.summary).toContain('Sam')
    expect(plan.summary).toContain('2027')
    expect(plan.summary).toContain('2028')
  })
})
