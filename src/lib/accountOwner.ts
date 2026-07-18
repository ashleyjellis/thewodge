/**
 * The schema's owner enum (person_a/person_b/joint) has no direct link to a real
 * person's name — accounts.personId is the real relational link, owner is a
 * display-order label. This resolves which label a chosen person maps to: the
 * first person in the household is person_a, the second is person_b. Pure,
 * client-safe (no server imports) — used by the account form to translate "who
 * does this belong to" into the stored enum.
 */
export type AccountOwner = 'person_a' | 'person_b' | 'joint'

export function personToOwner(
  people: { id: string }[],
  personId: string | null,
): AccountOwner {
  if (personId === null) return 'joint'
  const index = people.findIndex((p) => p.id === personId)
  return index === 1 ? 'person_b' : 'person_a'
}

/** Human label for an owner value, given the people list (for account rows/groups). */
export function ownerLabel(
  owner: AccountOwner,
  people: { id: string; name: string }[],
): string {
  if (owner === 'joint') return 'Joint'
  const index = owner === 'person_a' ? 0 : 1
  return people[index]?.name ?? (owner === 'person_a' ? 'Person 1' : 'Person 2')
}
