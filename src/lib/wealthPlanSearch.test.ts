import { describe, expect, it } from 'vitest'
import type { Person } from './household'
import {
  MAX_PEOPLE,
  peopleToSearch,
  searchToPeople,
  toWealthPlanInput,
  validateWealthPlanSearch,
  type WealthPlanSearch,
} from './wealthPlanSearch'

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'x',
    name: 'Someone',
    age: 30,
    targetAge: 65,
    salary: 0,
    pensionPct: 0,
    pension: 0,
    isaStocks: 0,
    isaCash: 0,
    cashSavings: 0,
    isaStocksMonthly: 0,
    isaCashMonthly: 0,
    cashSavingsMonthly: 0,
    bonus: 0,
    bonusTarget: 'isaStocks',
    ...overrides,
  }
}

describe('searchToPeople / peopleToSearch (household URL encoding)', () => {
  it('MAX_PEOPLE is 4 — "You" plus up to three more', () => {
    expect(MAX_PEOPLE).toBe(4)
  })

  it('a person-1-only search yields exactly one person, named "You"', () => {
    const s = validateWealthPlanSearch({ age: 34, targetAge: 60, pension: 50_000 })
    const people = searchToPeople(s)
    expect(people).toHaveLength(1)
    expect(people[0]!.name).toBe('You')
    expect(people[0]!.id).toBe('person-1')
    expect(people[0]!.age).toBe(34)
    expect(people[0]!.pension).toBe(50_000)
  })

  it('reads people 2-4 from their prefixed fields', () => {
    const s = validateWealthPlanSearch({
      age: 34,
      pension: 50_000,
      p2_name: 'Charlotte',
      p2_age: 32,
      p2_targetAge: 62,
      p2_isaStocks: 10_000,
      p2_bonusTarget: 'cashSavings',
    })
    const people = searchToPeople(s)
    expect(people).toHaveLength(2)
    expect(people[1]!.id).toBe('person-2')
    expect(people[1]!.name).toBe('Charlotte')
    expect(people[1]!.age).toBe(32)
    expect(people[1]!.targetAge).toBe(62)
    expect(people[1]!.isaStocks).toBe(10_000)
    expect(people[1]!.bonusTarget).toBe('cashSavings')
  })

  it('an unnamed additional person gets a "Person N" fallback', () => {
    const s = validateWealthPlanSearch({ age: 34, p2_age: 30, p2_pension: 1_000 })
    const people = searchToPeople(s)
    expect(people[1]!.name).toBe('Person 2')
  })

  it('a prefix with nothing set is not a person — later prefixes compact down', () => {
    // only p3_ has data; p2_ and p4_ are empty
    const s = validateWealthPlanSearch({ age: 34, p3_age: 28, p3_pension: 5_000 })
    const people = searchToPeople(s)
    expect(people).toHaveLength(2) // "You" + the one from p3_
    expect(people[1]!.id).toBe('person-2') // compacted to position 2, not 3
    expect(people[1]!.age).toBe(28)
  })

  it('round-trips a full household through peopleToSearch -> searchToPeople', () => {
    const people = [
      person({ id: 'a', name: 'You', age: 34, targetAge: 60, pension: 80_000, salary: 55_000, pensionPct: 0.05 }),
      person({ id: 'b', name: 'Charlotte', age: 32, targetAge: 62, isaStocks: 20_000, isaStocksMonthly: 150 }),
      person({ id: 'c', name: 'Jamie', age: 8, targetAge: 18, cashSavings: 500, bonus: 100, bonusTarget: 'cashSavings' }),
    ]
    const s = peopleToSearch(people)
    const roundTripped = searchToPeople(s)

    expect(roundTripped).toHaveLength(3)
    // person 1 has no separate "name" concept in the URL — always "You"
    expect(roundTripped[0]!.name).toBe('You')
    expect(roundTripped[0]!.age).toBe(34)
    expect(roundTripped[0]!.pension).toBe(80_000)
    expect(roundTripped[0]!.pensionPct).toBeCloseTo(0.05, 6)

    expect(roundTripped[1]!.name).toBe('Charlotte')
    expect(roundTripped[1]!.age).toBe(32)
    expect(roundTripped[1]!.isaStocks).toBe(20_000)
    expect(roundTripped[1]!.isaStocksMonthly).toBe(150)

    expect(roundTripped[2]!.name).toBe('Jamie')
    expect(roundTripped[2]!.age).toBe(8)
    expect(roundTripped[2]!.bonus).toBe(100)
    expect(roundTripped[2]!.bonusTarget).toBe('cashSavings')
  })

  it('ids are deterministic by position, not tied to identity — re-parsing the same URL is stable', () => {
    const s = peopleToSearch([person({ age: 34 }), person({ age: 30 }), person({ age: 60 })])
    const first = searchToPeople(s)
    const second = searchToPeople(s)
    expect(first.map((p) => p.id)).toEqual(second.map((p) => p.id))
    expect(first.map((p) => p.id)).toEqual(['person-1', 'person-2', 'person-3'])
  })

  it('caps at MAX_PEOPLE — a 5th person is silently dropped when writing to the URL', () => {
    const people = [
      person({ age: 34 }),
      person({ age: 30, name: 'B' }),
      person({ age: 31, name: 'C' }),
      person({ age: 32, name: 'D' }),
      person({ age: 33, name: 'E' }),
    ]
    const s = peopleToSearch(people)
    const roundTripped = searchToPeople(s)
    expect(roundTripped).toHaveLength(4)
    expect(roundTripped.map((p) => p.name)).toEqual(['You', 'B', 'C', 'D'])
  })

  it('removing a middle person and re-encoding shifts the rest down, leaving no gap', () => {
    const before = searchToPeople(
      peopleToSearch([person({ age: 34 }), person({ age: 30, name: 'B' }), person({ age: 31, name: 'C' })]),
    )
    expect(before.map((p) => p.name)).toEqual(['You', 'B', 'C'])

    // drop "B", exactly as the route would after a removal, then re-encode
    const after = searchToPeople(peopleToSearch([before[0]!, before[2]!]))
    expect(after.map((p) => p.name)).toEqual(['You', 'C'])
    expect(after[1]!.id).toBe('person-2')
  })

  it('does not disturb toWealthPlanInput / validateWealthPlanSearch for the existing single-person shape', () => {
    const s: WealthPlanSearch = validateWealthPlanSearch({
      age: '34',
      targetAge: '60',
      salary: '55000',
      pensionPct: '5',
      pension: '60000',
    })
    expect(s.age).toBe(34)
    const input = toWealthPlanInput(s)
    expect(input.age).toBe(34)
    expect(input.pensionPct).toBeCloseTo(0.05, 6)
    expect(input.pension).toBe(60_000)
  })
})
