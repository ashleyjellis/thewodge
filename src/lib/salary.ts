/**
 * Salary as an evolving input (pure, no IO) — a baseline figure and assumed
 * annual growth rate, with actual readings (salary_changes) superseding the
 * assumption from the year they land onward and the SAME assumed rate
 * compounding forward from that rebased point — the identical
 * actuals-vs-assumption relationship account_snapshots has with balances,
 * applied to salary (see the restructure brief's salary section).
 */
export type SalaryChangeInput = { effectiveYear: number; salary: number }

/**
 * Resolves the effective salary for every calendar year in [startYear,
 * endYear]. `baseSalary` is anchored at `baseYear` (typically "today"); each
 * actual change becomes a new anchor for the same growth rate to compound
 * from, in effectiveYear order — the latest change at or before a given
 * year always wins, matching resolveMonthlySchedule's "supersedes, doesn't
 * stack" rule elsewhere in this app. Never negative.
 */
export function resolveSalarySchedule(
  baseSalary: number,
  baseYear: number,
  growthPct: number,
  changes: SalaryChangeInput[],
  startYear: number,
  endYear: number,
): Map<number, number> {
  const sorted = [...changes].sort((a, b) => a.effectiveYear - b.effectiveYear)
  const schedule = new Map<number, number>()
  let anchorYear = baseYear
  let anchorValue = Math.max(0, baseSalary)
  let idx = 0

  for (let year = startYear; year <= endYear; year++) {
    while (idx < sorted.length && sorted[idx]!.effectiveYear <= year) {
      anchorYear = sorted[idx]!.effectiveYear
      anchorValue = Math.max(0, sorted[idx]!.salary)
      idx++
    }
    const value = anchorValue * Math.pow(1 + growthPct, year - anchorYear)
    schedule.set(year, Math.max(0, value))
  }
  return schedule
}
