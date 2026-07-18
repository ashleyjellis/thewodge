/**
 * Benchmarks (spec §3, §4 screen 1) — static, dated, sourced reference values.
 *
 * These power the one line that kills the no-benchmark anxiety: "£X at age Y ≈ N×
 * the median for your age." Because it is the single line users will most trust,
 * it is sourced and dated in the data itself and surfaced in the UI. v1 uses static
 * values — no live data (spec §3). Refreshing them is a known manual chore.
 *
 * Basis: ONS Wealth and Assets Survey — median private (non-state) pension wealth
 * by age band, Great Britain. The figures below are INDICATIVE reference values
 * modelled on the survey's published shape; verify against the latest ONS release
 * before production and update `asOf`. Pure — no IO.
 */

export type BenchmarkSource = {
  name: string
  url: string
  /** the survey period the figures relate to */
  asOf: string
  /** what exactly is being compared */
  basis: string
  /** honesty note surfaced in the UI */
  note: string
}

export const BENCHMARK_SOURCE: BenchmarkSource = {
  name: 'ONS Wealth and Assets Survey',
  url: 'https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/incomeandwealth/bulletins/pensionwealthingreatbritain/latest',
  asOf: 'April 2018 to March 2020',
  basis: 'median private (non-state) pension wealth by age band, Great Britain',
  note: 'Indicative reference values modelled on the ONS survey shape — verify against the latest ONS release before relying on them.',
}

export type BenchmarkBand = {
  minAge: number
  maxAge: number
  label: string
  /** median private pension wealth for the band */
  median: number
}

/** Median private pension wealth by age band (indicative — see BENCHMARK_SOURCE). */
export const PENSION_BENCHMARKS: BenchmarkBand[] = [
  { minAge: 16, maxAge: 24, label: '16–24', median: 1_000 },
  { minAge: 25, maxAge: 34, label: '25–34', median: 9_000 },
  { minAge: 35, maxAge: 44, label: '35–44', median: 40_000 },
  { minAge: 45, maxAge: 54, label: '45–54', median: 95_000 },
  { minAge: 55, maxAge: 64, label: '55–64', median: 175_000 },
  { minAge: 65, maxAge: 120, label: '65+', median: 160_000 },
]

export function benchmarkBandForAge(age: number): BenchmarkBand {
  const band = PENSION_BENCHMARKS.find((b) => age >= b.minAge && age <= b.maxAge)
  // clamp to the nearest band for out-of-range ages
  if (band) return band
  return age < PENSION_BENCHMARKS[0]!.minAge
    ? PENSION_BENCHMARKS[0]!
    : PENSION_BENCHMARKS[PENSION_BENCHMARKS.length - 1]!
}

export function medianForAge(age: number): number {
  return benchmarkBandForAge(age).median
}

export type BenchmarkResult = {
  median: number
  band: BenchmarkBand
  /** value ÷ median — how many times the median the user holds */
  multiple: number
}

/**
 * How the user's invested total compares to the median for their age.
 * e.g. £221,000 at 36 vs a £40,000 median ≈ 5.5×.
 */
export function benchmarkMultiple(value: number, age: number): BenchmarkResult {
  const band = benchmarkBandForAge(age)
  return {
    median: band.median,
    band,
    multiple: band.median > 0 ? value / band.median : 0,
  }
}
