/**
 * Compiles a house-move input into a one-off planned_events row (the move
 * cost) plus an optional second contribution_changes row if ongoing saving
 * changes from that year on — e.g. a bigger mortgage leaving less to save.
 * Zero engine changes: a plain composition of the two existing primitives,
 * same spirit as maternityLeave.ts.
 */
import type { AccountOwner } from '../accountOwner.js'
import type { PotCategory } from '../householdForecast.js'
import type { LifeEventPlan } from './types.js'

export type HouseMoveInput = {
  owner: AccountOwner
  potCategory: PotCategory
  year: number
  /** the one-off moving cost — always modelled as money out; a positive
   *  windfall (e.g. downsizing) isn't this form's job, "Something else"
   *  already covers an arbitrary in/out event */
  moveCost: number
  /** this pot's current normal monthly contribution, as resolved from the
   *  live schedule by the caller — same reasoning as maternityLeave.ts */
  normalMonthlyContribution: number
  /** null = ongoing saving is unaffected by the move — no second row */
  newMonthlyContribution: number | null
}

/** Null when there's no real cost to record. */
export function buildHouseMovePlan(input: HouseMoveInput): LifeEventPlan | null {
  if (input.moveCost <= 0) return null

  const changesSaving =
    input.newMonthlyContribution !== null && input.newMonthlyContribution !== input.normalMonthlyContribution

  return {
    summary: `House move — ${input.year}${changesSaving ? ', saving rate changes too' : ''}`,
    contributionChanges: changesSaving
      ? [
          {
            owner: input.owner,
            potCategory: input.potCategory,
            effectiveYear: input.year,
            changeType: 'set',
            value: Math.max(0, input.newMonthlyContribution!),
            note: 'Saving rate after the move',
          },
        ]
      : [],
    plannedEvents: [
      {
        owner: input.owner,
        potCategory: input.potCategory,
        year: input.year,
        name: 'House move',
        amount: -Math.abs(input.moveCost),
        note: 'One-off moving cost',
      },
    ],
  }
}
