import { describe, expect, it } from 'vitest'
import { checkPensionAccess, type PensionAccessPerson } from './pensionAccess'

const ashley: PensionAccessPerson = { name: 'Ashley', age: 31, retirementAge: 56 }
const charlotte: PensionAccessPerson = { name: 'Charlotte', age: 31, retirementAge: 55 }
const people = { personA: charlotte, personB: ashley }

describe('checkPensionAccess', () => {
  it('always allows a deposit (positive amount) into pension, any year', () => {
    expect(checkPensionAccess({ owner: 'person_a', potCategory: 'pension', year: 2026, amount: 5_000 }, 2026, people))
      .toEqual({ allowed: true })
  })

  it('always allows a withdrawal from investments or cash — pension is the only locked pot', () => {
    expect(
      checkPensionAccess({ owner: 'person_a', potCategory: 'investments', year: 2026, amount: -5_000 }, 2026, people),
    ).toEqual({ allowed: true })
    expect(checkPensionAccess({ owner: 'person_a', potCategory: 'cash', year: 2026, amount: -5_000 }, 2026, people))
      .toEqual({ allowed: true })
  })

  it("blocks a pension withdrawal before that owner's own retirement year", () => {
    // Charlotte is 31, retires at 55 → unlocks in 2050
    const result = checkPensionAccess(
      { owner: 'person_a', potCategory: 'pension', year: 2040, amount: -10_000 },
      2026,
      people,
    )
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.reason).toMatch(/Charlotte.*2050/)
  })

  it("allows a pension withdrawal at or after that owner's own retirement year", () => {
    expect(
      checkPensionAccess({ owner: 'person_a', potCategory: 'pension', year: 2050, amount: -10_000 }, 2026, people),
    ).toEqual({ allowed: true })
    expect(
      checkPensionAccess({ owner: 'person_a', potCategory: 'pension', year: 2060, amount: -10_000 }, 2026, people),
    ).toEqual({ allowed: true })
  })

  it('uses each owner\'s OWN retirement age — person_b is not blocked by person_a\'s later one', () => {
    // Ashley is 31, retires at 56 -> unlocks 2051 (later than Charlotte's 2050)
    // a withdrawal in 2050 should still be blocked for Ashley even though
    // Charlotte could access hers that year
    const result = checkPensionAccess(
      { owner: 'person_b', potCategory: 'pension', year: 2050, amount: -1 },
      2026,
      people,
    )
    expect(result.allowed).toBe(false)
  })

  it('a joint pension withdrawal is blocked until the LATER of the two own ages', () => {
    // Charlotte unlocks 2050, Ashley unlocks 2051 — joint should use 2051
    const blocked = checkPensionAccess(
      { owner: 'joint', potCategory: 'pension', year: 2050, amount: -1 },
      2026,
      people,
    )
    expect(blocked.allowed).toBe(false)
    if (!blocked.allowed) expect(blocked.reason).toMatch(/Ashley.*2051/)

    const allowed = checkPensionAccess(
      { owner: 'joint', potCategory: 'pension', year: 2051, amount: -1 },
      2026,
      people,
    )
    expect(allowed.allowed).toBe(true)
  })

  it('never blocks when the relevant person does not exist yet', () => {
    expect(
      checkPensionAccess(
        { owner: 'person_b', potCategory: 'pension', year: 2026, amount: -10_000 },
        2026,
        { personA: charlotte, personB: null },
      ),
    ).toEqual({ allowed: true })
  })
})
