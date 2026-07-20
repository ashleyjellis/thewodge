import { describe, expect, it } from 'vitest'
import { greetingForHour } from './greeting'

describe('greetingForHour', () => {
  it('is morning from 5am up to (not including) noon', () => {
    expect(greetingForHour(5)).toBe('Good morning')
    expect(greetingForHour(11)).toBe('Good morning')
  })
  it('is afternoon from noon up to (not including) 6pm', () => {
    expect(greetingForHour(12)).toBe('Good afternoon')
    expect(greetingForHour(17)).toBe('Good afternoon')
  })
  it('is evening from 6pm through the small hours', () => {
    expect(greetingForHour(18)).toBe('Good evening')
    expect(greetingForHour(23)).toBe('Good evening')
    expect(greetingForHour(0)).toBe('Good evening')
    expect(greetingForHour(4)).toBe('Good evening')
  })
})
