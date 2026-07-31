/**
 * Search params for /wealth-planning-tool — stateless like the free calculator
 * (see search.ts): every input lives in the URL, nothing is saved or sent, and the
 * page is shareable/bookmarkable as-is. A separate type from CalculatorSearch
 * because this tool asks for four named pots (not three) plus a salary-based
 * pension percentage and a bonus — genuinely different shape, not an extension.
 *
 * A household beyond one person is encoded the same way: person 1 ("You")
 * keeps these exact flat params, unprefixed, so every URL that already exists
 * keeps working unchanged. People 2-4 get the same field set again, each
 * under its own p2_/p3_/p4_ prefix — flat and readable rather than a JSON
 * blob, so a shared link stays inspectable. See searchToPeople/peopleToSearch.
 */
import { CASH_RATE, INVESTED_RATE, TARGET_AGE } from '../config'
import type { Assumptions } from './forecast'
import type { Person } from './household'
import type { PotKey, WealthPlanInput } from './wealthPlan'
import { POT_KEYS } from './wealthPlan'

/** The field set collected for any one person — identical for "You" and
 *  every additional person, per-person retirement age included. Person 1
 *  alone omits `name` in the URL (always shown as "You"). */
type PersonFields = {
  name?: string
  age?: number
  targetAge?: number
  salary?: number
  /** whole percent, e.g. 5 for 5% — converted to a fraction in toWealthPlanInput */
  pensionPct?: number
  pension?: number
  isaStocks?: number
  isaCash?: number
  cashSavings?: number
  isaStocksMonthly?: number
  isaCashMonthly?: number
  cashSavingsMonthly?: number
  bonus?: number
  bonusTarget?: PotKey
}

type Prefixed<P extends string, T> = { [K in keyof T as `${P}${K & string}`]: T[K] }

const PERSON_FIELD_NAMES = [
  'name',
  'age',
  'targetAge',
  'salary',
  'pensionPct',
  'pension',
  'isaStocks',
  'isaCash',
  'cashSavings',
  'isaStocksMonthly',
  'isaCashMonthly',
  'cashSavingsMonthly',
  'bonus',
  'bonusTarget',
] as const satisfies readonly (keyof PersonFields)[]

/** People 2-4 — person 1 ("You") is the page's one mandatory person and is
 *  never prefixed. Capped at 4 total so the URL and the form stay bounded. */
export const MAX_PEOPLE = 4
const PERSON_PREFIXES = ['p2_', 'p3_', 'p4_'] as const

export type WealthPlanSearch = Omit<PersonFields, 'name'> & {
  /** whole percent — pension + ISA stocks & shares; defaults to the sitewide rate */
  investedRatePct?: number
  /** whole percent — ISA cash + cash savings; defaults to the sitewide rate */
  cashRatePct?: number
} & Prefixed<'p2_', PersonFields> &
  Prefixed<'p3_', PersonFields> &
  Prefixed<'p4_', PersonFields>

const NON_NEGATIVE = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

const POT_KEY_SET = new Set<string>(POT_KEYS)
const asPotKey = (v: unknown): PotKey | undefined =>
  typeof v === 'string' && POT_KEY_SET.has(v) ? (v as PotKey) : undefined

/** Coerces and bounds one person's field set out of the raw search object,
 *  reading each field under the given prefix ('' for person 1). */
function validatePersonFields(search: Record<string, unknown>, prefix: string): PersonFields {
  const age = NON_NEGATIVE(search[`${prefix}age`])
  const targetAge = NON_NEGATIVE(search[`${prefix}targetAge`])
  const name = search[`${prefix}name`]
  return {
    name: typeof name === 'string' && name.trim() !== '' ? name.trim().slice(0, 60) : undefined,
    age: age !== undefined ? Math.min(age, 120) : undefined,
    targetAge: targetAge !== undefined ? Math.min(targetAge, 120) : undefined,
    salary: NON_NEGATIVE(search[`${prefix}salary`]),
    pensionPct: NON_NEGATIVE(search[`${prefix}pensionPct`]),
    pension: NON_NEGATIVE(search[`${prefix}pension`]),
    isaStocks: NON_NEGATIVE(search[`${prefix}isaStocks`]),
    isaCash: NON_NEGATIVE(search[`${prefix}isaCash`]),
    cashSavings: NON_NEGATIVE(search[`${prefix}cashSavings`]),
    isaStocksMonthly: NON_NEGATIVE(search[`${prefix}isaStocksMonthly`]),
    isaCashMonthly: NON_NEGATIVE(search[`${prefix}isaCashMonthly`]),
    cashSavingsMonthly: NON_NEGATIVE(search[`${prefix}cashSavingsMonthly`]),
    bonus: NON_NEGATIVE(search[`${prefix}bonus`]),
    bonusTarget: asPotKey(search[`${prefix}bonusTarget`]),
  }
}

/** Renames a person's fields onto the given prefix (age -> p2_age, ...). Kept
 *  loosely typed (Record, not the precise Prefixed<> mapped type) because
 *  both call sites merge the result with Object.assign, not literal spread —
 *  see peopleToSearch. */
function prefixFields(prefix: string, fields: PersonFields): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of PERSON_FIELD_NAMES) out[`${prefix}${field}`] = fields[field]
  return out
}

/** validateSearch for the route — coerces and bounds the params. */
export function validateWealthPlanSearch(
  search: Record<string, unknown>,
): WealthPlanSearch {
  const { name: _dropped, ...person1 } = validatePersonFields(search, '')
  const out: WealthPlanSearch = {
    ...person1,
    investedRatePct: NON_NEGATIVE(search.investedRatePct),
    cashRatePct: NON_NEGATIVE(search.cashRatePct),
  }
  Object.assign(out, prefixFields('p2_', validatePersonFields(search, 'p2_')))
  Object.assign(out, prefixFields('p3_', validatePersonFields(search, 'p3_')))
  Object.assign(out, prefixFields('p4_', validatePersonFields(search, 'p4_')))
  return out
}

/** Whether we have enough to draw a plan: an age, plus something to grow. */
export function canPlan(s: WealthPlanSearch): boolean {
  const hasAge = s.age !== undefined && s.age > 0 && s.age < 120
  const hasSomething =
    (s.pension ?? 0) +
      (s.isaStocks ?? 0) +
      (s.isaCash ?? 0) +
      (s.cashSavings ?? 0) +
      (s.isaStocksMonthly ?? 0) +
      (s.isaCashMonthly ?? 0) +
      (s.cashSavingsMonthly ?? 0) +
      ((s.salary ?? 0) > 0 && (s.pensionPct ?? 0) > 0 ? 1 : 0) >
    0
  return hasAge && hasSomething
}

/** Fraction → a clean whole/half-percent number for display — avoids float noise
 *  like 0.07 × 100 = 7.000000000000001 showing up in a form field. */
export function rateToPct(rate: number): number {
  return Math.round(rate * 10000) / 100
}

export function toWealthPlanAssumptions(s: WealthPlanSearch): Assumptions {
  return {
    investedRate: s.investedRatePct !== undefined ? s.investedRatePct / 100 : INVESTED_RATE,
    cashRate: s.cashRatePct !== undefined ? s.cashRatePct / 100 : CASH_RATE,
    targetAge: s.targetAge ?? TARGET_AGE,
  }
}

/** Takes person 1's own (unprefixed) field set, but the shape is shared with
 *  every additional person too — see searchToPeople, which reuses this for
 *  people 2-4 by passing their unprefixed PersonFields directly. */
export function toWealthPlanInput(s: Omit<PersonFields, 'name'>): WealthPlanInput {
  return {
    age: s.age ?? 0,
    targetAge: s.targetAge ?? TARGET_AGE,
    salary: s.salary ?? 0,
    pensionPct: (s.pensionPct ?? 0) / 100,
    pension: s.pension ?? 0,
    isaStocks: s.isaStocks ?? 0,
    isaCash: s.isaCash ?? 0,
    cashSavings: s.cashSavings ?? 0,
    isaStocksMonthly: s.isaStocksMonthly ?? 0,
    isaCashMonthly: s.isaCashMonthly ?? 0,
    cashSavingsMonthly: s.cashSavingsMonthly ?? 0,
    bonus: s.bonus ?? 0,
    bonusTarget: s.bonusTarget ?? 'isaStocks',
  }
}

/** The exact inverse of toWealthPlanInput — a person's fraction-based fields
 *  back to the URL's whole-percent shape. */
function inputToSearchFields(input: WealthPlanInput): Omit<PersonFields, 'name'> {
  return {
    age: input.age,
    targetAge: input.targetAge,
    salary: input.salary,
    pensionPct: rateToPct(input.pensionPct),
    pension: input.pension,
    isaStocks: input.isaStocks,
    isaCash: input.isaCash,
    cashSavings: input.cashSavings,
    isaStocksMonthly: input.isaStocksMonthly,
    isaCashMonthly: input.isaCashMonthly,
    cashSavingsMonthly: input.cashSavingsMonthly,
    bonus: input.bonus,
    bonusTarget: input.bonusTarget,
  }
}

/** Deterministic per-position ids ("person-1".."person-4") — re-parsing the
 *  same URL always assigns the same id to the person in the same position,
 *  so React never churns keys (losing e.g. focus or scroll state) just
 *  because the page re-read its own search params. */
const personId = (position: number) => `person-${position + 1}`

/** URL -> people. Person 1 ("You") always exists, built from today's flat
 *  fields. People 2-4 are read in prefix order and compacted — a prefix with
 *  nothing set simply isn't a person, so removing someone never leaves a gap
 *  the next person has to "skip" (see peopleToSearch, its exact inverse). */
export function searchToPeople(s: WealthPlanSearch): Person[] {
  const people: Person[] = [{ id: personId(0), name: 'You', ...toWealthPlanInput(s) }]
  for (const prefix of PERSON_PREFIXES) {
    const fields = personFieldsAt(s, prefix)
    if (PERSON_FIELD_NAMES.every((field) => fields[field] === undefined)) continue
    people.push({
      id: personId(people.length),
      name: fields.name ?? `Person ${people.length + 1}`,
      ...toWealthPlanInput(fields),
    })
  }
  return people
}

/** Reads one prefix's worth of fields back out of an already-validated
 *  WealthPlanSearch — the read-side counterpart to prefixFields. */
function personFieldsAt(s: WealthPlanSearch, prefix: string): PersonFields {
  const rec = s as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const field of PERSON_FIELD_NAMES) out[field] = rec[`${prefix}${field}`]
  return out as PersonFields
}

/** People -> URL, the exact inverse of searchToPeople. Person 1 always maps
 *  to the unprefixed fields; people 2-4 map onto p2_/p3_/p4_ in array order,
 *  so removing someone shifts everyone after them down rather than leaving a
 *  hole. Anything beyond MAX_PEOPLE is silently dropped — the form is the
 *  one place that should ever let the array grow that long. */
export function peopleToSearch(people: Person[]): WealthPlanSearch {
  const out: WealthPlanSearch = people[0] ? inputToSearchFields(people[0]) : {}
  people
    .slice(1, MAX_PEOPLE)
    .forEach((person, i) =>
      Object.assign(out, prefixFields(PERSON_PREFIXES[i]!, { name: person.name, ...inputToSearchFields(person) })),
    )
  return out
}

