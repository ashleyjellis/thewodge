/**
 * Resolves which of Today's three bespoke states applies — pure, no IO.
 * today.tsx does the data-fetching and hands this simple, already-resolved
 * numbers; this just decides.
 *
 * Priority: down-market reassurance beats the movement moment. A real dip
 * is more useful, honest information right now than a celebration of
 * something the user just did — showing both at once would read oddly
 * (congratulating them while their portfolio is down), and reassurance is
 * the one that actually needs saying.
 */
export type TodayState =
  | { kind: 'ambient'; crossoverYear: number | null }
  | { kind: 'full_screen_moment'; crossoverYear: number | null }
  | { kind: 'down_market_reassurance'; crossoverYear: number | null }

export type BandComparison = {
  actualValue: number
  lowValue: number
  midValue: number
}

/**
 * A genuine, honestly-reassurable dip: actual has fallen short of Mid, but
 * still clears Low — the exact case the copy can say "still within the
 * range we planned for." If actual has fallen below Low too, that claim
 * would be false, so this deliberately does NOT treat it as reassurable —
 * it falls through to whichever other state applies, rather than inventing
 * a new alarming state (this app never shows a red/alarm state).
 */
function isReassurableDip(comparison: BandComparison): boolean {
  return comparison.actualValue < comparison.midValue && comparison.actualValue >= comparison.lowValue
}

export function resolveTodayState(params: {
  justChanged: boolean
  crossoverYear: number | null
  comparison: BandComparison | null
}): TodayState {
  if (params.comparison && isReassurableDip(params.comparison)) {
    return { kind: 'down_market_reassurance', crossoverYear: params.crossoverYear }
  }
  if (params.justChanged) {
    return { kind: 'full_screen_moment', crossoverYear: params.crossoverYear }
  }
  return { kind: 'ambient', crossoverYear: params.crossoverYear }
}
