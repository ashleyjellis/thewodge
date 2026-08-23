/**
 * The weekly entry screen — the one that has to be fast.
 *
 * See WeeklyGrid for why it is shaped the way it is. This route is the thin
 * part: fetch the portfolios, hand the save to the API, and report exactly
 * what happened afterwards rather than a bare "saved".
 */
import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { WeeklyGrid, type GridPortfolio, type PreparedRow } from '@/components/tracker/WeeklyGrid'

export const Route = createFileRoute('/performance/admin/entry')({
  component: WeeklyEntry,
})

type SaveSummary = { saved: number; replaced: number; portfoliosAffected: number }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function WeeklyEntry() {
  const [portfolios, setPortfolios] = useState<GridPortfolio[] | null>(null)
  const [valuationDate, setValuationDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState<SaveSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/tracker/entry')
    const data = await response.json()
    if (data?.ok) setPortfolios(data.portfolios)
    else setError(data?.error ?? 'could not load portfolios')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(rows: PreparedRow[]) {
    setSaving(true)
    setError(null)
    setSummary(null)
    try {
      const response = await fetch('/api/tracker/entry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          valuationDate,
          rows: rows.map((row) => ({
            portfolioId: row.portfolioId,
            valuePence: row.valuePence,
            valuationDate: row.valuationDate ?? valuationDate,
            source: row.source,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? 'could not save')
        return
      }
      setSummary({
        saved: data.saved,
        replaced: data.replaced,
        portfoliosAffected: data.portfoliosAffected,
      })
      // Reload so the "last value" column reflects what was just written —
      // otherwise the next entry would compare against a stale figure and the
      // typo guard would measure the wrong move.
      await load()
    } catch {
      setError('could not reach the server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          Admin
        </p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-foreground">
          Weekly entry
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          One value per portfolio. Tab moves down the column.
        </p>
      </div>

      {summary ? (
        <div className="rounded-2xl bg-accent/40 p-4 text-[14px] text-foreground">
          Saved {summary.saved} reading{summary.saved === 1 ? '' : 's'} across{' '}
          {summary.portfoliosAffected} portfolio
          {summary.portfoliosAffected === 1 ? '' : 's'}
          {summary.replaced > 0
            ? `, of which ${summary.replaced} replaced an existing reading for that date`
            : ''}
          . Series rebuilt.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl bg-card p-4 text-[14px] text-foreground shadow-sm">{error}</div>
      ) : null}

      {portfolios === null ? (
        <p className="text-[14px] text-muted-foreground">Loading…</p>
      ) : portfolios.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">
          No active portfolios yet.
        </p>
      ) : (
        <WeeklyGrid
          portfolios={portfolios}
          valuationDate={valuationDate}
          onValuationDateChange={setValuationDate}
          onSave={save}
          saving={saving}
        />
      )}
    </div>
  )
}
