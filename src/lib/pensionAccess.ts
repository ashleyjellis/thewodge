/**
 * Pension isn't freely withdrawable the way savings/investments are — a
 * negative planned event (a withdrawal) against a pension pot is blocked
 * before the relevant person's own retirement age. A joint pension event is
 * blocked until the LATER of the two people's own ages, the same
 * whole-picture convention used everywhere else two people's horizons
 * combine (see householdForecast.ts's householdTargetAge). Anything else —
 * a deposit, or any event against savings/investments — is always allowed.
 */
export type PensionAccessPerson = { name: string; age: number; retirementAge: number }

export type PensionAccessCheck = {
  owner: 'person_a' | 'person_b' | 'joint'
  potCategory: 'pension' | 'investments' | 'cash'
  year: number
  amount: number
}

export type PensionAccessResult = { allowed: true } | { allowed: false; reason: string }

export function checkPensionAccess(
  check: PensionAccessCheck,
  currentCalendarYear: number,
  people: { personA: PensionAccessPerson | null; personB: PensionAccessPerson | null },
): PensionAccessResult {
  if (check.potCategory !== 'pension' || check.amount >= 0) return { allowed: true }

  const relevant =
    check.owner === 'person_a'
      ? [people.personA]
      : check.owner === 'person_b'
        ? [people.personB]
        : [people.personA, people.personB]
  const known = relevant.filter((p): p is PensionAccessPerson => p !== null)
  if (known.length === 0) return { allowed: true } // no one to check against — nothing to block

  const latest = known
    .map((p) => ({ person: p, unlockYear: currentCalendarYear + (p.retirementAge - p.age) }))
    .reduce((a, b) => (b.unlockYear > a.unlockYear ? b : a))

  if (check.year < latest.unlockYear) {
    return {
      allowed: false,
      reason: `${latest.person.name} can't access their pension until ${latest.unlockYear} (age ${latest.person.retirementAge}).`,
    }
  }
  return { allowed: true }
}
