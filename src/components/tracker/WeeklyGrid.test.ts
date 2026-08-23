import { describe, expect, it } from 'vitest'
import { needsConfirmation, rowChange, TYPO_GUARD_THRESHOLD } from './WeeklyGrid'

describe('the change column', () => {
  it('computes the week-on-week move', () => {
    expect(rowChange(51_000, 50_000)).toBeCloseTo(0.02, 6)
    expect(rowChange(49_000, 50_000)).toBeCloseTo(-0.02, 6)
  })

  it('has nothing to compare against on a first reading', () => {
    expect(rowChange(50_000, null)).toBeNull()
    expect(rowChange(null, 50_000)).toBeNull()
  })

  it('does not divide by zero', () => {
    expect(rowChange(50_000, 0)).toBeNull()
  })
})

describe('the typo guard', () => {
  it('lets an ordinary week through', () => {
    expect(needsConfirmation(rowChange(52_000, 50_000))).toBe(false) // +4%
    expect(needsConfirmation(rowChange(48_000, 50_000))).toBe(false) // -4%
  })

  it('stops a move beyond the threshold, in either direction', () => {
    expect(needsConfirmation(rowChange(53_000, 50_000))).toBe(true) // +6%
    expect(needsConfirmation(rowChange(47_000, 50_000))).toBe(true) // -6%
  })

  it('catches the transposed digit it exists for', () => {
    // £518.45 typed as £581.45 — plausible-looking, and a 12% jump
    expect(needsConfirmation(rowChange(58_145, 51_845))).toBe(true)
    // a misplaced decimal is not subtle, but must not slip through either
    expect(needsConfirmation(rowChange(5_184, 51_845))).toBe(true)
  })

  it('does not fire exactly on the threshold', () => {
    expect(needsConfirmation(TYPO_GUARD_THRESHOLD)).toBe(false)
    expect(needsConfirmation(TYPO_GUARD_THRESHOLD + 0.0001)).toBe(true)
  })

  it('has nothing to guard when there is no prior reading', () => {
    expect(needsConfirmation(null)).toBe(false)
  })
})
