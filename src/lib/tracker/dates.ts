/**
 * ISO date helpers.
 *
 * Dates in this system are calendar dates, not instants — the day a provider
 * says a valuation applies to. Working in whole UTC days avoids every
 * timezone and daylight-saving question, none of which have any meaning for
 * "the value as at 3 March".
 */

const MS_PER_DAY = 86_400_000

/** 'YYYY-MM-DD' (or a full ISO timestamp) to a whole-day number. */
export function toEpochDay(iso: string): number {
  const date = iso.slice(0, 10)
  const parsed = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed)) throw new Error(`invalid date: ${iso}`)
  return Math.round(parsed / MS_PER_DAY)
}

export function fromEpochDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from)
}

export function addDays(iso: string, days: number): string {
  return fromEpochDay(toEpochDay(iso) + days)
}

/** Whole weeks between two dates, rounded to nearest — for "N weeks" copy. */
export function weeksBetween(from: string, to: string): number {
  return Math.round(daysBetween(from, to) / 7)
}
