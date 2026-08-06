import { describe, expect, it } from 'vitest'
import { resolveTodayState } from './todayState'

describe('resolveTodayState', () => {
  it('defaults to ambient when nothing just changed and there is no dip', () => {
    const state = resolveTodayState({ justChanged: false, crossoverYear: 2041, comparison: null })
    expect(state).toEqual({ kind: 'ambient', crossoverYear: 2041 })
  })

  it('shows the full-screen moment when justChanged is true and there is no dip', () => {
    const state = resolveTodayState({ justChanged: true, crossoverYear: 2041, comparison: null })
    expect(state).toEqual({ kind: 'full_screen_moment', crossoverYear: 2041 })
  })

  it('shows reassurance when actual has dipped below mid but still clears low', () => {
    const state = resolveTodayState({
      justChanged: false,
      crossoverYear: 2041,
      comparison: { actualValue: 105_000, lowValue: 100_000, midValue: 120_000 },
    })
    expect(state).toEqual({ kind: 'down_market_reassurance', crossoverYear: 2041 })
  })

  it('reassurance takes priority over the full-screen moment when both conditions hold', () => {
    const state = resolveTodayState({
      justChanged: true,
      crossoverYear: 2041,
      comparison: { actualValue: 105_000, lowValue: 100_000, midValue: 120_000 },
    })
    expect(state.kind).toBe('down_market_reassurance')
  })

  it('does not claim reassurance when actual is at or above mid — nothing to reassure about', () => {
    const state = resolveTodayState({
      justChanged: false,
      crossoverYear: 2041,
      comparison: { actualValue: 120_000, lowValue: 100_000, midValue: 120_000 },
    })
    expect(state.kind).toBe('ambient')
  })

  it('never claims "still within range" when actual has fallen below low too — falls back instead of guessing a new state', () => {
    const state = resolveTodayState({
      justChanged: false,
      crossoverYear: 2041,
      comparison: { actualValue: 90_000, lowValue: 100_000, midValue: 120_000 },
    })
    expect(state.kind).toBe('ambient')
  })

  it('a boundary actual exactly equal to low still counts as reassurable', () => {
    const state = resolveTodayState({
      justChanged: false,
      crossoverYear: 2041,
      comparison: { actualValue: 100_000, lowValue: 100_000, midValue: 120_000 },
    })
    expect(state.kind).toBe('down_market_reassurance')
  })

  it('passes a null crossoverYear straight through in every state', () => {
    expect(resolveTodayState({ justChanged: false, crossoverYear: null, comparison: null }).crossoverYear).toBeNull()
    expect(resolveTodayState({ justChanged: true, crossoverYear: null, comparison: null }).crossoverYear).toBeNull()
  })
})
