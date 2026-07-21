import { describe, expect, it } from 'vitest'
import { resolveSalarySchedule } from './salary'

describe('resolveSalarySchedule', () => {
  it('compounds the assumed growth rate forward from the baseline with no changes', () => {
    const schedule = resolveSalarySchedule(93_500, 2026, 0.02, [], 2026, 2029)
    expect(schedule.get(2026)).toBeCloseTo(93_500, 2)
    expect(schedule.get(2027)).toBeCloseTo(93_500 * 1.02, 2)
    expect(schedule.get(2028)).toBeCloseTo(93_500 * 1.02 ** 2, 2)
    expect(schedule.get(2029)).toBeCloseTo(93_500 * 1.02 ** 3, 2)
  })

  it('an actual reading supersedes the assumption from its year onward', () => {
    const schedule = resolveSalarySchedule(
      93_500,
      2026,
      0.02,
      [{ effectiveYear: 2028, salary: 100_000 }],
      2026,
      2029,
    )
    expect(schedule.get(2027)).toBeCloseTo(93_500 * 1.02, 2) // still the assumption before the actual lands
    expect(schedule.get(2028)).toBe(100_000) // the actual, exactly
    expect(schedule.get(2029)).toBeCloseTo(100_000 * 1.02, 2) // growth resumes from the rebased figure
  })

  it('a later actual supersedes an earlier one, not stacked', () => {
    const schedule = resolveSalarySchedule(
      50_000,
      2026,
      0.03,
      [
        { effectiveYear: 2027, salary: 55_000 },
        { effectiveYear: 2029, salary: 70_000 },
      ],
      2026,
      2030,
    )
    expect(schedule.get(2027)).toBe(55_000)
    expect(schedule.get(2028)).toBeCloseTo(55_000 * 1.03, 2)
    expect(schedule.get(2029)).toBe(70_000)
    expect(schedule.get(2030)).toBeCloseTo(70_000 * 1.03, 2)
  })

  it('changes out of order are still applied in effectiveYear order', () => {
    const schedule = resolveSalarySchedule(
      50_000,
      2026,
      0,
      [
        { effectiveYear: 2029, salary: 70_000 },
        { effectiveYear: 2027, salary: 55_000 },
      ],
      2026,
      2030,
    )
    expect(schedule.get(2027)).toBe(55_000)
    expect(schedule.get(2029)).toBe(70_000)
  })

  it('never goes negative even with a negative growth rate', () => {
    const schedule = resolveSalarySchedule(10_000, 2026, -0.9, [], 2026, 2040)
    for (const value of schedule.values()) expect(value).toBeGreaterThanOrEqual(0)
  })

  it('a zero growth rate holds the salary flat between actuals', () => {
    const schedule = resolveSalarySchedule(80_000, 2026, 0, [], 2026, 2030)
    expect([...schedule.values()]).toEqual([80_000, 80_000, 80_000, 80_000, 80_000])
  })
})
