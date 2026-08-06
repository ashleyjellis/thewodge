import { describe, expect, it } from 'vitest'
import { parseDiaryEntry } from './diaryParser'
import type { ScheduledPlanAccount } from './scheduledPlan'

const twoPeople = [
  { name: 'Sam', salary: 60_000 },
  { name: 'Alex', salary: 45_000 },
]
const onePerson = [{ name: 'Sam', salary: 60_000 }]
const accounts: ScheduledPlanAccount[] = [
  { owner: 'person_a', potCategory: 'investments', monthlyContribution: 500, currentBalance: 20_000 },
  { owner: 'person_b', potCategory: 'investments', monthlyContribution: 300, currentBalance: 10_000 },
  { owner: 'joint', potCategory: 'cash', monthlyContribution: 200, currentBalance: 15_000 },
]

describe('parseDiaryEntry — maternity/paternity leave', () => {
  it('matches a realistic maternity phrasing naming a person and both years', () => {
    const result = parseDiaryEntry({
      text: "Sam's going on maternity leave in 2027, back at work 2028",
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.kind).toBe('maternity_paternity_leave')
    expect(result.plan.contributionChanges[0]!.owner).toBe('person_a')
    expect(result.plan.contributionChanges[0]!.effectiveYear).toBe(2027)
    expect(result.plan.contributionChanges[1]!.effectiveYear).toBe(2028)
  })

  it('matches paternity leave and defaults the return year to start+1 when only one year is given', () => {
    const result = parseDiaryEntry({
      text: 'Taking paternity leave from 2027',
      people: onePerson,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.plan.contributionChanges[0]!.effectiveYear).toBe(2027)
    expect(result.plan.contributionChanges[1]!.effectiveYear).toBe(2028)
  })

  it('resolves the right person even with two people in the household, by name', () => {
    const result = parseDiaryEntry({
      text: "Alex's maternity leave starts 2027, returning 2028",
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.plan.contributionChanges[0]!.owner).toBe('person_b')
  })

  it('defaults to the one salaried person in a single-person household when no name is given', () => {
    const result = parseDiaryEntry({
      text: 'Maternity leave starting 2027, back 2028',
      people: onePerson,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.plan.contributionChanges[0]!.owner).toBe('person_a')
  })

  it('refuses to guess whose leave it is with two people and no name mentioned', () => {
    const result = parseDiaryEntry({
      text: 'Going on maternity leave in 2027, back 2028',
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(false)
  })

  it('does not match when no year is mentioned at all', () => {
    const result = parseDiaryEntry({
      text: "Sam's going on maternity leave soon",
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(false)
  })
})

describe('parseDiaryEntry — house move', () => {
  it('matches a realistic house-move phrasing with a cost and a year', () => {
    const result = parseDiaryEntry({
      text: 'Buying a house in 2028, deposit is £15,000',
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.kind).toBe('house_move')
    expect(result.plan.plannedEvents[0]!.amount).toBe(-15_000)
    expect(result.plan.plannedEvents[0]!.year).toBe(2028)
    expect(result.plan.plannedEvents[0]!.owner).toBe('joint')
  })

  it('understands £15k shorthand', () => {
    const result = parseDiaryEntry({
      text: 'Moving house 2028, costs about £15k all in',
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.plan.plannedEvents[0]!.amount).toBe(-15_000)
  })

  it('resolves a named owner instead of defaulting to joint', () => {
    const result = parseDiaryEntry({
      text: "Sam is moving house in 2028, £10,000 deposit",
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.plan.plannedEvents[0]!.owner).toBe('person_a')
  })

  it('does not match without a cost figure', () => {
    const result = parseDiaryEntry({
      text: 'Moving house in 2028',
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(false)
  })

  it('does not match "house" mentioned without any move/buy language', () => {
    const result = parseDiaryEntry({
      text: 'Fixed the roof on the house in 2028, cost £2,000',
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(false)
  })
})

describe('parseDiaryEntry — new child', () => {
  it('matches a realistic new-child phrasing with a monthly figure and both years', () => {
    const result = parseDiaryEntry({
      text: 'New baby due 2028, cutting savings by £150 a month until 2030',
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.kind).toBe('new_child')
    expect(result.plan.contributionChanges[0]!.effectiveYear).toBe(2028)
    expect(result.plan.contributionChanges[1]!.effectiveYear).toBe(2030)
  })

  it('defaults the end year to start+1 when only one year is given', () => {
    const result = parseDiaryEntry({
      text: 'Expecting a child in 2028, reducing saving by £150',
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.plan.contributionChanges[1]!.effectiveYear).toBe(2029)
  })

  it('does not match without an amount', () => {
    const result = parseDiaryEntry({
      text: 'New baby coming in 2028',
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(false)
  })
})

describe('parseDiaryEntry — priority and fallback', () => {
  it('maternity/paternity language takes priority over new-child keywords in the same sentence', () => {
    const result = parseDiaryEntry({
      text: "New baby! Sam's maternity leave runs 2027 to 2028",
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.kind).toBe('maternity_paternity_leave')
  })

  it('never matches deliberately unrecognisable input', () => {
    const result = parseDiaryEntry({
      text: 'Had a nice coffee this morning, thinking about the weekend',
      people: twoPeople,
      accounts,
      contributionChanges: [],
    })
    expect(result.matched).toBe(false)
  })

  it('never matches empty or whitespace-only input', () => {
    expect(parseDiaryEntry({ text: '', people: twoPeople, accounts, contributionChanges: [] }).matched).toBe(false)
    expect(parseDiaryEntry({ text: '   ', people: twoPeople, accounts, contributionChanges: [] }).matched).toBe(false)
  })

  it('never throws on garbled or symbol-heavy input', () => {
    expect(() =>
      parseDiaryEntry({ text: '£$%^&*()_+ 20272028 house house move move', people: twoPeople, accounts, contributionChanges: [] }),
    ).not.toThrow()
  })
})
