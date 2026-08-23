/**
 * The weekly entry grid.
 *
 * The brief is blunt that this screen decides whether the project survives to
 * month three: entry across a dozen portfolios has to take under five minutes
 * or it will not happen. Everything here serves that, and the things that
 * look like fussy details are the things that make it fast.
 *
 * - One valuation date at the top applying to every row, overridable per row,
 *   because a provider is occasionally a day behind the rest.
 * - Tab moves DOWN the column rather than across the row. Entry is one column
 *   of numbers read off one column of screens; the default tab order would
 *   send the cursor into the source selector between every value.
 * - The value field takes what is actually on the clipboard — a pound sign,
 *   thousands separators, stray spaces — instead of demanding a clean number.
 * - The change column updates as you type, so a mistake is visible before
 *   saving rather than after.
 *
 * ## The typo guard
 *
 * Any implied move beyond ±5% needs an explicit confirmation before the batch
 * can be saved. The brief calls this the single feature that will catch most
 * data-entry errors, and data-entry errors are the main threat to the
 * credibility of a published record — a transposed digit is indistinguishable
 * from a real crash once it is in the series.
 *
 * Five percent in a week is genuinely rare, and genuinely possible. So this
 * blocks rather than warns, and confirming takes one click: the cost of a
 * false stop is a second, and the cost of a missed typo is a wrong number
 * published as verified.
 */
import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { formatPence, formatReturn, parsePence } from '@/lib/tracker/money'
import { cn } from '@/lib/cn'
import type { ReadingSource } from '@/server/trackerDb/schema'

/** A week-on-week move beyond this needs confirming before it can be saved. */
export const TYPO_GUARD_THRESHOLD = 0.05

export type GridPortfolio = {
  id: number
  name: string
  providerName: string
  riskLabel: string | null
  lastValuePence: number | null
  lastValuationDate: string | null
}

export type GridRowState = {
  raw: string
  valuationDate: string | null
  source: ReadingSource
  confirmed: boolean
}

export type PreparedRow = {
  portfolioId: number
  valuePence: number
  valuationDate: string | null
  source: ReadingSource
}

const SOURCES: ReadingSource[] = ['web', 'app', 'statement']

export function rowChange(valuePence: number | null, lastValuePence: number | null): number | null {
  if (valuePence === null || lastValuePence === null || lastValuePence === 0) return null
  return (valuePence - lastValuePence) / lastValuePence
}

export function needsConfirmation(change: number | null): boolean {
  return change !== null && Math.abs(change) > TYPO_GUARD_THRESHOLD
}

export function WeeklyGrid({
  portfolios,
  valuationDate,
  onValuationDateChange,
  onSave,
  saving,
}: {
  portfolios: GridPortfolio[]
  valuationDate: string
  onValuationDateChange: (date: string) => void
  onSave: (rows: PreparedRow[]) => void
  saving: boolean
}) {
  const [rows, setRows] = useState<Record<number, GridRowState>>({})
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function update(portfolioId: number, patch: Partial<GridRowState>) {
    setRows((current) => ({
      ...current,
      [portfolioId]: {
        raw: '',
        valuationDate: null,
        source: 'web',
        confirmed: false,
        ...current[portfolioId],
        ...patch,
      },
    }))
  }

  const prepared = useMemo(() => {
    return portfolios.map((portfolio) => {
      const state = rows[portfolio.id]
      const valuePence = state?.raw ? parsePence(state.raw) : null
      const change = rowChange(valuePence, portfolio.lastValuePence)
      const needsConfirm = needsConfirmation(change)
      return {
        portfolio,
        state,
        valuePence,
        change,
        needsConfirm,
        // An entry that cannot be parsed is not "zero" — it is unfinished, and
        // saving it would write a fabricated reading.
        unparseable: Boolean(state?.raw && state.raw.trim() !== '' && valuePence === null),
        blocked: needsConfirm && !state?.confirmed,
      }
    })
  }, [portfolios, rows])

  const filled = prepared.filter((row) => row.valuePence !== null)
  const blocked = prepared.filter((row) => row.blocked)
  const unparseable = prepared.filter((row) => row.unparseable)
  const canSave = filled.length > 0 && blocked.length === 0 && unparseable.length === 0 && !saving

  /** Tab down the column; shift-tab back up. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== 'Tab') return
    const next = event.shiftKey ? index - 1 : index + 1
    const target = inputRefs.current[next]
    if (!target) return
    event.preventDefault()
    target.focus()
    target.select()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-card p-4 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Valuation date
          </span>
          <input
            type="date"
            value={valuationDate}
            onChange={(event) => onValuationDateChange(event.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-[14px]"
          />
        </label>
        <p className="pb-2 text-[13px] text-muted-foreground">
          Applies to every row. Override any single row in its own date field.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-card shadow-sm">
        <table className="w-full min-w-[900px] text-[14px]">
          <thead>
            <tr className="border-b border-border/70 text-left text-[12px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Portfolio</th>
              <th className="px-4 py-3 text-right font-medium">Last value</th>
              <th className="px-4 py-3 font-medium">Last read</th>
              <th className="px-4 py-3 font-medium">New value</th>
              <th className="px-4 py-3 text-right font-medium">Change</th>
              <th className="px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {prepared.map((row, index) => (
              <tr
                key={row.portfolio.id}
                className={cn(
                  'border-b border-border/40 last:border-0',
                  row.blocked && 'bg-accent/40',
                )}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.portfolio.providerName}</div>
                  <div className="text-[13px] text-muted-foreground">
                    {row.portfolio.name}
                    {row.portfolio.riskLabel ? ` · ${row.portfolio.riskLabel}` : ''}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.portfolio.lastValuePence === null
                    ? '—'
                    : formatPence(row.portfolio.lastValuePence)}
                </td>
                <td className="px-4 py-3 text-[13px] text-muted-foreground">
                  {row.portfolio.lastValuationDate ?? 'never'}
                </td>
                <td className="px-4 py-3">
                  <input
                    ref={(element) => {
                      inputRefs.current[index] = element
                    }}
                    inputMode="decimal"
                    // Deliberately not "£0.00", which reads as a value that
                    // has been entered rather than a field that is empty.
                    placeholder="—"
                    value={row.state?.raw ?? ''}
                    onChange={(event) =>
                      update(row.portfolio.id, { raw: event.target.value, confirmed: false })
                    }
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    aria-label={`New value for ${row.portfolio.providerName} ${row.portfolio.name}`}
                    aria-invalid={row.unparseable || row.blocked}
                    className={cn(
                      'w-36 rounded-xl border bg-background px-3 py-2 text-right tabular-nums',
                      row.unparseable ? 'border-foreground' : 'border-border',
                    )}
                  />
                  {row.unparseable ? (
                    <p className="mt-1 text-[12px] text-muted-foreground">Not a number</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.change === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <span className="tabular-nums">{formatReturn(row.change)}</span>
                      {row.needsConfirm ? (
                        <label
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-background px-2 py-1 text-[12px] font-medium"
                          title={`A move of ${formatReturn(row.change)} in a week is unusual — confirm it is not a typo`}
                        >
                          <input
                            type="checkbox"
                            checked={row.state?.confirmed ?? false}
                            onChange={(event) =>
                              update(row.portfolio.id, { confirmed: event.target.checked })
                            }
                            aria-label={`Confirm the ${formatReturn(row.change)} move for ${row.portfolio.providerName}`}
                          />
                          {row.state?.confirmed ? (
                            <>
                              <Check size={13} strokeWidth={2.5} /> confirmed
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={13} strokeWidth={2.5} /> confirm
                            </>
                          )}
                        </label>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={row.state?.source ?? 'web'}
                    onChange={(event) =>
                      update(row.portfolio.id, { source: event.target.value as ReadingSource })
                    }
                    aria-label={`Source for ${row.portfolio.providerName}`}
                    className="rounded-xl border border-border bg-background px-2.5 py-2 text-[13px]"
                  >
                    {SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!canSave}
          onClick={() =>
            onSave(
              filled.map((row) => ({
                portfolioId: row.portfolio.id,
                valuePence: row.valuePence!,
                valuationDate: row.state?.valuationDate ?? null,
                source: row.state?.source ?? 'web',
              })),
            )
          }
          className="rounded-full bg-foreground px-5 py-2.5 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saving ? 'Saving…' : `Save ${filled.length} reading${filled.length === 1 ? '' : 's'}`}
        </button>

        {blocked.length > 0 ? (
          <p className="text-[13px] text-foreground">
            {blocked.length} row{blocked.length === 1 ? '' : 's'} moved more than{' '}
            {Math.round(TYPO_GUARD_THRESHOLD * 100)}% — confirm{' '}
            {blocked.length === 1 ? 'it' : 'them'} before saving.
          </p>
        ) : null}
        {unparseable.length > 0 ? (
          <p className="text-[13px] text-foreground">
            {unparseable.length} value{unparseable.length === 1 ? '' : 's'} could not be read as a
            number.
          </p>
        ) : null}
      </div>
    </div>
  )
}
