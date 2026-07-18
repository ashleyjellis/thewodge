/**
 * Formatting — plain UK English, numbers do the emotional work (brand guide §1, §9).
 *
 * Currency always carries the £ and is never abbreviated in headline positions
 * (data-viz rule: "£820,000", never "£820k"). Pure — no IO.
 */

const gbp0 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

const gbp2 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** £1,750,000 — full, with a proper minus sign for negatives. */
export function money(value: number): string {
  const rounded = Math.round(value)
  if (rounded < 0) return `−${gbp0.format(Math.abs(rounded))}`
  return gbp0.format(rounded)
}

/** £18.38 — for small "value of £1" figures where the pennies matter. */
export function moneyPrecise(value: number): string {
  if (value < 0) return `−${gbp2.format(Math.abs(value))}`
  return gbp2.format(value)
}

/** 7% · 4.5% — trims trailing zeros. */
export function percent(fraction: number, dp = 1): string {
  const pct = fraction * 100
  const rounded = Number(pct.toFixed(dp))
  return `${rounded}%`
}

/** 5.5× — the benchmark multiple. */
export function multiple(value: number, dp = 1): string {
  return `${value.toFixed(dp)}×`
}

/** "24 years" · "1 year" */
export function years(n: number): string {
  return `${n} ${n === 1 ? 'year' : 'years'}`
}
