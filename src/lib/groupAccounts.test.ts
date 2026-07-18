import { describe, expect, it } from 'vitest'
import { groupAccounts } from './groupAccounts'

const people = [
  { id: 'p1', name: 'Sam' },
  { id: 'p2', name: 'Alex' },
]

describe('groupAccounts', () => {
  it('groups by owner, in person_a, person_b, joint order', () => {
    const accounts = [
      { owner: 'joint' as const, potCategory: 'cash' as const, id: 'j1' },
      { owner: 'person_b' as const, potCategory: 'pension' as const, id: 'b1' },
      { owner: 'person_a' as const, potCategory: 'pension' as const, id: 'a1' },
    ]
    const groups = groupAccounts(accounts, people)
    expect(groups.map((g) => g.owner)).toEqual(['person_a', 'person_b', 'joint'])
    expect(groups.map((g) => g.label)).toEqual(['Sam', 'Alex', 'Joint'])
  })

  it('omits an owner group entirely when they have no accounts', () => {
    const accounts = [{ owner: 'person_a' as const, potCategory: 'cash' as const, id: 'a1' }]
    const groups = groupAccounts(accounts, people)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.owner).toBe('person_a')
  })

  it('sub-groups by pot category in pension, investments, cash order', () => {
    const accounts = [
      { owner: 'person_a' as const, potCategory: 'cash' as const, id: 'c1' },
      { owner: 'person_a' as const, potCategory: 'pension' as const, id: 'p1' },
      { owner: 'person_a' as const, potCategory: 'investments' as const, id: 'i1' },
    ]
    const groups = groupAccounts(accounts, people)
    expect(groups[0]!.potGroups.map((g) => g.potCategory)).toEqual([
      'pension',
      'investments',
      'cash',
    ])
  })

  it('omits an empty pot sub-group', () => {
    const accounts = [{ owner: 'person_a' as const, potCategory: 'cash' as const, id: 'c1' }]
    const groups = groupAccounts(accounts, people)
    expect(groups[0]!.potGroups).toHaveLength(1)
    expect(groups[0]!.potGroups[0]!.potCategory).toBe('cash')
  })

  it('returns an empty array for no accounts', () => {
    expect(groupAccounts([], people)).toEqual([])
  })
})
