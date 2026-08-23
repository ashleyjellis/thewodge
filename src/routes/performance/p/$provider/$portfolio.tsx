/**
 * The provider page — the main public surface.
 *
 * Built to the supplied mockup's structure and copy, rendered in this site's
 * own tokens rather than the mockup's palette, so Performance reads as part
 * of The Wodge rather than as a second product bolted on. The one place that
 * matters most is the drawdown: the mockup gives it a rust border, and this
 * project's brand rule is no reds, tied to calm over anxiety. It gets its
 * weight from size and a bordered card instead — which suits the copy better
 * anyway, since the point being made is that a fall like this is ordinary.
 *
 * Deliberate omissions, both from the brief:
 *
 * - **No timeframe filters.** Since-inception only, with the start date in
 *   the eyebrow. Offering "1 year" on a series eleven weeks long invites a
 *   comparison the data cannot support.
 * - **No ranking.** The peer block reports an average and a spread. A league
 *   table over a run this short would be measuring the market, not a manager.
 */
import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { DEMO_MODE, SITE_NAME } from '@/config'
import { surfaceSeo } from '@/lib/surfaceSeo'
import { MaxWidthContainer } from '@/components/site/Container'
import { DemoBanner } from '@/components/tracker/DemoBanner'
import { SeriesChart } from '@/components/tracker/SeriesChart'
import { PeerBars } from '@/components/tracker/PeerBars'
import {
  buildProviderPageView,
  summarisePeerBand,
  type Peer,
} from '@/lib/tracker/providerPage'
import { formatBps, formatPence, formatReturn, formatUnitPrice, parsePence } from '@/lib/tracker/money'
import { cn } from '@/lib/cn'

export const Route = createFileRoute('/performance/p/$provider/$portfolio')({
  head: () => {
    const seo = surfaceSeo('performance', {
      title: `Portfolio performance — ${SITE_NAME}`,
      description: 'What one managed portfolio actually did, week by week.',
      path: '/performance',
    })
    return { links: seo.links, meta: seo.meta }
  },
  component: ProviderPage,
})

type Payload = {
  provider: { slug: string; name: string; isDemo: boolean }
  portfolio: {
    slug: string
    name: string
    riskLabel: string | null
    wrapper: string | null
    inceptionDate: string
    accountOpenDate: string | null
    initialPence: number
    platformFeeBps: number | null
    feeTiersJson: string | null
    ocfBps: number | null
  }
  readings: { valuationDate: string; readAt: string; valuePence: number; source: string; note: string | null }[]
  flows: { effectiveDate: string; amountPence: number; kind: 'initial' | 'contribution' | 'withdrawal' }[]
  peers: Peer[]
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
    {children}
  </p>
)

function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 inline-flex overflow-hidden rounded-full border border-border" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'px-4 py-2 text-[13px] transition-colors',
              value === option.value
                ? 'bg-foreground text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProviderPage() {
  const { provider, portfolio } = Route.useParams()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feesDeducted, setFeesDeducted] = useState(false)
  const [balanceInput, setBalanceInput] = useState('£500')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tracker/portfolio?provider=${provider}&portfolio=${portfolio}`)
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return
        if (payload?.ok) setData(payload)
        else setError(payload?.error ?? 'could not load this portfolio')
      })
      .catch(() => !cancelled && setError('could not reach the server'))
    return () => {
      cancelled = true
    }
  }, [provider, portfolio])

  const modelledBalancePence = useMemo(() => {
    const parsed = parsePence(balanceInput)
    // A floor rather than an error: someone mid-edit has typed "£" and
    // nothing else, and blanking the whole page for that would be hostile.
    return parsed && parsed >= 10_000 ? Math.min(parsed, 25_000_000) : 50_000
  }, [balanceInput])

  const view = useMemo(() => {
    if (!data) return null
    return buildProviderPageView(data.portfolio, data.readings, data.flows, {
      feesDeducted,
      modelledBalancePence,
    })
  }, [data, feesDeducted, modelledBalancePence])

  if (error) {
    return (
      <MaxWidthContainer className="py-20">
        <p className="text-[15px] text-muted-foreground">{error}</p>
      </MaxWidthContainer>
    )
  }
  if (!data || !view) {
    return (
      <MaxWidthContainer className="py-20">
        <p className="text-[15px] text-muted-foreground">Loading…</p>
      </MaxWidthContainer>
    )
  }

  const peerSummary = summarisePeerBand(data.peers, 'provider_risk_label')
  const { drawdown } = view

  return (
    <>
      <DemoBanner />
      <MaxWidthContainer className="pb-20 pt-10">
        <Eyebrow>
          Real money · opened {data.portfolio.inceptionDate} ·{' '}
          {view.readingCount} reading{view.readingCount === 1 ? '' : 's'} taken by hand
        </Eyebrow>

        <h1 className="mt-3 text-[clamp(28px,5vw,42px)] font-semibold leading-[1.08] tracking-tight text-foreground">
          {data.provider.name}, {data.portfolio.name}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Provider's own risk label: {data.portfolio.riskLabel ?? 'not stated'}
          {data.portfolio.wrapper ? ` · ${data.portfolio.wrapper.toUpperCase()}` : ''} ·{' '}
          {view.hasFlows ? 'money added since day one' : 'no money added since day one'}
        </p>

        {/* the ledger line — the signature moment */}
        <div className="mt-8 flex flex-wrap items-baseline gap-4">
          <span className="text-[clamp(20px,3.4vw,28px)] tabular-nums text-muted-foreground">
            {formatPence(view.scaledOpeningPence)}
          </span>
          <span className="text-[clamp(20px,3.4vw,28px)] text-border">→</span>
          <span className="text-[clamp(34px,6.6vw,56px)] font-semibold tabular-nums leading-none tracking-tight text-foreground">
            {formatPence(view.scaledCurrentPence)}
          </span>
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">
          {feesDeducted
            ? `After platform fees of ${formatBps(view.appliedFeeBps)} a year`
            : 'Before platform fees'}{' '}
          · modelled on {formatPence(modelledBalancePence)} · {view.weeksRunning} weeks · last read{' '}
          {view.lastValuationDate}
        </p>

        {view.isThin ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <p className="text-[17px] font-semibold text-foreground">
              {view.readingCount} reading{view.readingCount === 1 ? '' : 's'} so far. Too early to
              mean anything — that's the point of publishing it.
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Returns, volatility and the deepest-fall figure all need more of a run before they
              say anything worth reading. They will appear here as the series grows.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-7 flex flex-wrap gap-10">
              <div>
                <Eyebrow>Simple return</Eyebrow>
                <p className="mt-1 text-[21px] tabular-nums text-foreground">
                  {view.simple === null ? '—' : formatReturn(view.simple)}
                </p>
              </div>
              <div>
                <Eyebrow>Time-weighted</Eyebrow>
                <p className="mt-1 text-[21px] tabular-nums text-foreground">
                  {view.twr === null ? '—' : formatReturn(view.twr)}
                </p>
              </div>
              <div>
                <Eyebrow>Fees so far</Eyebrow>
                <p className="mt-1 text-[21px] tabular-nums text-foreground">
                  {formatPence(view.feesSoFarPence)}
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground">
              {view.returnsEquivalent
                ? 'Both return figures are identical here because nothing has been paid in since day one. They only separate once money moves in or out — the difference is entirely about timing, not about the manager.'
                : 'These two differ because money has been paid in since day one. Time-weighted strips out the timing of those payments; simple return does not.'}
            </p>
          </>
        )}

        <div className="mt-9 flex flex-wrap items-end gap-8 border-y border-border py-6">
          <Segmented
            label="Platform fee"
            value={feesDeducted ? 'on' : 'off'}
            onChange={(value) => setFeesDeducted(value === 'on')}
            options={[
              { value: 'off', label: 'Excluded' },
              { value: 'on', label: 'Deducted' },
            ]}
          />
          <div>
            <label className="block" htmlFor="modelled-balance">
              <Eyebrow>Model at a balance of</Eyebrow>
            </label>
            <input
              id="modelled-balance"
              type="text"
              inputMode="numeric"
              value={balanceInput}
              onChange={(event) => setBalanceInput(event.target.value)}
              className="mt-2 w-32 rounded-xl border border-border bg-card px-3 py-2 text-[14px] tabular-nums"
            />
          </div>
        </div>

        {!view.isThin && view.series.length > 1 ? (
          <section className="mt-10">
            <div className="rounded-2xl border border-border bg-card p-4">
              <SeriesChart
                points={view.series}
                peakDate={drawdown.peakDate}
                troughDate={drawdown.troughDate}
                recoveryDate={drawdown.recoveryDate}
                ariaLabel={`Unit price since ${data.portfolio.inceptionDate}. Deepest fall ${
                  drawdown.maxDrawdown === 0 ? 'none' : formatReturn(drawdown.maxDrawdown)
                }.`}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-6 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-0 w-4 border-t-2 border-foreground" />
                Weekly value
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-2.5 w-0 border-l-[1.5px] border-foreground" />
                Each mark is a reading a human took
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-2.5 w-4 rounded-sm bg-accent" />
                Period below the previous high
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" />
                No reading taken — price carried forward
              </span>
            </div>

            {drawdown.troughDate ? (
              <div className="mt-7 rounded-2xl border border-foreground/25 bg-card p-6">
                <Eyebrow>Deepest fall so far</Eyebrow>
                <p className="mt-3 text-[22px] font-semibold leading-snug tracking-tight text-foreground">
                  Down {formatReturn(drawdown.maxDrawdown).replace('-', '')} —{' '}
                  {drawdown.hasRecovered
                    ? `it took ${drawdown.recoveryWeeks} week${drawdown.recoveryWeeks === 1 ? '' : 's'} to get back.`
                    : `not recovered — ${drawdown.weeksSinceTrough} week${drawdown.weeksSinceTrough === 1 ? '' : 's'} and counting.`}
                </p>
                <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-muted-foreground">
                  Peak on {drawdown.peakDate}, low on {drawdown.troughDate}
                  {drawdown.hasRecovered ? `, back above the old high on ${drawdown.recoveryDate}` : ''}.
                  Over a run this short a fall like this is ordinary, not a warning sign. This figure
                  is on every provider page because it is the number most people actually want and
                  almost nobody publishes.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {peerSummary && !view.isThin ? (
          <section className="mt-14 border-t border-border pt-12">
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
              Against others at the same risk level
            </h2>
            <p className="mt-2 max-w-[62ch] text-[14px] text-muted-foreground">
              {peerSummary.count} tracked portfolio{peerSummary.count === 1 ? '' : 's'} carr
              {peerSummary.count === 1 ? 'ies' : 'y'} the same risk label. Grouped by what each
              provider calls it, not by how much they have actually moved — those labels are not
              comparable between firms, and there is not yet enough history to group them honestly.
              This is an average and a spread, not a league table.
            </p>
            <PeerBars
              min={peerSummary.narrowest}
              max={peerSummary.widest}
              rows={[
                { label: 'This portfolio', value: peerSummary.self, isSelf: true },
                { label: `Band average (${peerSummary.count})`, value: peerSummary.average, isSelf: false },
                { label: 'Widest in band', value: peerSummary.widest, isSelf: false },
                { label: 'Narrowest in band', value: peerSummary.narrowest, isSelf: false },
              ]}
            />
          </section>
        ) : null}

        <section className="mt-14 border-t border-border pt-12">
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground">The ledger</h2>
          <p className="mt-2 max-w-[62ch] text-[14px] text-muted-foreground">
            Every reading, in the order it was taken. The unit price is value divided by units held,
            so paying money in adds units without moving the price.
          </p>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[600px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Valued</th>
                  <th className="px-4 py-3 font-medium">Read on</th>
                  <th className="px-4 py-3 text-right font-medium">Unit price</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-right font-medium">Week</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {view.series
                  .filter((point) => !point.isOpening)
                  .map((point, index, all) => {
                    const previous = all[index - 1]
                    const weekMove =
                      previous && previous.unitPriceMicro > 0
                        ? point.unitPriceMicro / previous.unitPriceMicro - 1
                        : null
                    const reading = data.readings.find((r) => r.valuationDate === point.onDate)
                    return (
                      <tr key={point.onDate} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-2.5 tabular-nums">{point.onDate}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {reading ? reading.readAt.slice(0, 10) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatUnitPrice(point.unitPriceMicro)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatPence(point.valuePence)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {weekMove === null ? '—' : formatReturn(weekMove)}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {point.isForwardFilled ? 'no reading — carried forward' : (reading?.source ?? '—')}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14">
          <div className="rounded-2xl bg-foreground p-8 text-primary-foreground">
            <h2 className="text-[22px] font-semibold tracking-tight">I'm invested in this one</h2>
            <p className="mt-2 max-w-[52ch] text-[14px] opacity-80">
              Get a short note whenever this portfolio moves more than 2% in a week, changes what it
              holds, or adjusts its charges. Nothing else.
            </p>
            <form
              className="mt-6 flex flex-wrap gap-3"
              onSubmit={(event) => event.preventDefault()}
            >
              <input
                type="email"
                placeholder="you@example.com"
                aria-label="Email address"
                className="min-w-[220px] flex-1 rounded-xl border border-primary-foreground/30 bg-primary-foreground/10 px-4 py-2.5 text-[15px] text-primary-foreground placeholder:text-primary-foreground/50"
              />
              <button
                type="submit"
                className="rounded-xl bg-primary-foreground px-5 py-2.5 text-[15px] font-medium text-foreground"
              >
                Track this portfolio
              </button>
            </form>
            <p className="mt-4 text-[12px] opacity-60">
              Roughly two emails a month. One click to stop.
              {DEMO_MODE ? ' Not wired up while this is demo data.' : ''}
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-12">
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
            How to read all this
          </h2>
          <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
            The pound figure is what the account actually shows, restated at whatever balance you
            model above. Underlying fund charges are already inside the unit price
            {data.portfolio.ocfBps ? ` (${formatBps(data.portfolio.ocfBps)} a year here)` : ''}; the
            platform fee is modelled from the provider's published rate card, which is why changing
            the balance moves it. Readings are taken by hand from the provider's own screen — there
            is no automated collection anywhere in this. A short run measures a moment in the
            market, not a manager.
          </p>
        </section>
      </MaxWidthContainer>
    </>
  )
}
