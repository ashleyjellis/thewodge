import { describe, expect, it } from 'vitest'
import { ownerLabel, personToOwner } from './accountOwner'

describe('personToOwner', () => {
  const people = [{ id: 'p1' }, { id: 'p2' }]

  it('maps the first person to person_a', () => {
    expect(personToOwner(people, 'p1')).toBe('person_a')
  })

  it('maps the second person to person_b', () => {
    expect(personToOwner(people, 'p2')).toBe('person_b')
  })

  it('maps null to joint', () => {
    expect(personToOwner(people, null)).toBe('joint')
  })

  it('falls back to person_a for an unrecognised id', () => {
    expect(personToOwner(people, 'nope')).toBe('person_a')
  })
})

describe('ownerLabel', () => {
  const people = [
    { id: 'p1', name: 'Sam' },
    { id: 'p2', name: 'Alex' },
  ]

  it('labels joint as Joint', () => {
    expect(ownerLabel('joint', people)).toBe('Joint')
  })

  it('labels person_a/person_b with the real name', () => {
    expect(ownerLabel('person_a', people)).toBe('Sam')
    expect(ownerLabel('person_b', people)).toBe('Alex')
  })

  it('falls back to a generic label when the person is missing', () => {
    expect(ownerLabel('person_b', [people[0]!])).toBe('Person 2')
  })
})
