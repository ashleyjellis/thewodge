/**
 * "Parse what you said" — a deterministic, keyword/pattern parser from free
 * text to one of the three typed life-event compilers (Phase 9/10). No LLM,
 * no NLP library: this codebase has zero existing infrastructure for
 * either, and a stochastic parser has no single clean formula for a "how we
 * worked this out" drawer — on-brand with this app's fully-explainable
 * ethos. A true general-purpose parser is a separate, later infrastructure
 * decision, not folded in here.
 *
 * Every match is a real compiled LifeEventPlan (the same type the typed
 * forms produce), meant to be shown via the existing PlanUpdatePreview
 * before anything is saved — never applied silently. When nothing
 * confidently matches, or a matched kind is missing a field it actually
 * needs (no year found, no amount found, an ambiguous "whose leave is
 * this" with two people and neither named), this returns unmatched rather
 * than guessing — the caller falls back to the plain picker.
 */
import type { AccountOwner } from './accountOwner.js'
import type { PotCategory } from './householdForecast.js'
import type { OwnerScopedContributionChange, ScheduledPlanAccount } from './scheduledPlan.js'
import { resolveContributionBreakdown } from './scheduledPlan.js'
import { buildMaternityLeavePlan } from './lifeEvents/maternityLeave.js'
import { buildHouseMovePlan } from './lifeEvents/houseMove.js'
import { buildNewChildPlan } from './lifeEvents/newChild.js'
import type { LifeEventKind, LifeEventPlan } from './lifeEvents/types.js'

export type DiaryParseResult = { matched: true; kind: LifeEventKind; plan: LifeEventPlan } | { matched: false }

const DEFAULT_POT: PotCategory = 'investments'
const HOUSE_MOVE_POT: PotCategory = 'cash'

function findYears(text: string): number[] {
  const matches = text.match(/\b20\d{2}\b/g) ?? []
  return matches.map(Number)
}

function findAmount(text: string): number | null {
  const match = text.match(/£\s?([\d,]+(?:\.\d+)?)\s?(k\b)?/i)
  if (!match) return null
  const raw = Number(match[1]!.replace(/,/g, ''))
  if (!Number.isFinite(raw)) return null
  return match[2] ? raw * 1000 : raw
}

/** A word-boundary, case-insensitive match against each known person's
 *  name — never a guess when it's ambiguous between two real people. */
function findNamedOwner(
  text: string,
  people: { name: string }[],
): { owner: 'person_a' | 'person_b'; index: 0 | 1 } | null {
  for (const [index, person] of people.entries()) {
    if (index > 1 || !person.name.trim()) continue
    const pattern = new RegExp(`\\b${person.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(text)) return { owner: index === 0 ? 'person_a' : 'person_b', index: index as 0 | 1 }
  }
  return null
}

function normalMonthlyFor(
  owner: AccountOwner,
  potCategory: PotCategory,
  year: number,
  accounts: ScheduledPlanAccount[],
  contributionChanges: OwnerScopedContributionChange[],
): number {
  return (
    resolveContributionBreakdown({ year, accounts, changes: contributionChanges }).find(
      (r) => r.owner === owner && r.potCategory === potCategory,
    )?.monthly ?? 0
  )
}

function parseMaternityLeave(
  text: string,
  people: { name: string; salary: number | null }[],
  accounts: ScheduledPlanAccount[],
  contributionChanges: OwnerScopedContributionChange[],
): LifeEventPlan | null {
  const leaveType = /matern/i.test(text) ? ('maternity' as const) : ('paternity' as const)

  const named = findNamedOwner(text, people)
  const salaried = people
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.salary !== null && p.salary > 0)
  const resolved = named ?? (salaried.length === 1 ? { owner: salaried[0]!.i === 0 ? 'person_a' as const : 'person_b' as const, index: salaried[0]!.i as 0 | 1 } : null)
  if (!resolved) return null
  const person = people[resolved.index]
  if (!person || person.salary === null || person.salary <= 0) return null

  const years = findYears(text)
  if (years.length === 0) return null
  const leaveStartYear = years[0]!
  const returnYear = years[1] ?? leaveStartYear + 1

  const normalMonthlyContribution = normalMonthlyFor(resolved.owner, DEFAULT_POT, leaveStartYear, accounts, contributionChanges)

  return buildMaternityLeavePlan({
    personName: person.name,
    owner: resolved.owner,
    potCategory: DEFAULT_POT,
    leaveType,
    annualSalary: person.salary,
    normalMonthlyContribution,
    leaveStartYear,
    returnYear,
  })
}

function parseHouseMove(
  text: string,
  people: { name: string }[],
  accounts: ScheduledPlanAccount[],
  contributionChanges: OwnerScopedContributionChange[],
): LifeEventPlan | null {
  const years = findYears(text)
  if (years.length === 0) return null
  const moveCost = findAmount(text)
  if (moveCost === null || moveCost <= 0) return null

  const named = findNamedOwner(text, people)
  const owner: AccountOwner = named?.owner ?? 'joint'
  const normalMonthlyContribution = normalMonthlyFor(owner, HOUSE_MOVE_POT, years[0]!, accounts, contributionChanges)

  return buildHouseMovePlan({
    owner,
    potCategory: HOUSE_MOVE_POT,
    year: years[0]!,
    moveCost,
    normalMonthlyContribution,
    newMonthlyContribution: null,
  })
}

function parseNewChild(
  text: string,
  people: { name: string }[],
  accounts: ScheduledPlanAccount[],
  contributionChanges: OwnerScopedContributionChange[],
): LifeEventPlan | null {
  const years = findYears(text)
  if (years.length === 0) return null
  const startYear = years[0]!
  const endYear = years[1] ?? startYear + 1
  const monthlyCostReduction = findAmount(text)
  if (monthlyCostReduction === null || monthlyCostReduction <= 0) return null

  const named = findNamedOwner(text, people)
  const owner: AccountOwner = named?.owner ?? 'joint'
  const normalMonthlyContribution = normalMonthlyFor(owner, DEFAULT_POT, startYear, accounts, contributionChanges)

  return buildNewChildPlan({
    owner,
    potCategory: DEFAULT_POT,
    normalMonthlyContribution,
    monthlyCostReduction,
    startYear,
    endYear,
  })
}

export function parseDiaryEntry(params: {
  text: string
  people: { name: string; salary: number | null }[]
  accounts: ScheduledPlanAccount[]
  contributionChanges: OwnerScopedContributionChange[]
}): DiaryParseResult {
  const text = params.text.trim()
  if (!text) return { matched: false }

  const isMaternityPaternity = /matern|patern/i.test(text)
  const isHouseMove = /\bhouse\b/i.test(text) && /\b(mov(e|ing)|buy(ing)?)\b/i.test(text)
  const isNewChild = /\b(baby|babies|child|newborn|pregnant|expecting)\b/i.test(text)

  if (isMaternityPaternity) {
    const plan = parseMaternityLeave(text, params.people, params.accounts, params.contributionChanges)
    if (plan) return { matched: true, kind: 'maternity_paternity_leave', plan }
  }
  if (isHouseMove) {
    const plan = parseHouseMove(text, params.people, params.accounts, params.contributionChanges)
    if (plan) return { matched: true, kind: 'house_move', plan }
  }
  if (isNewChild) {
    const plan = parseNewChild(text, params.people, params.accounts, params.contributionChanges)
    if (plan) return { matched: true, kind: 'new_child', plan }
  }
  return { matched: false }
}
