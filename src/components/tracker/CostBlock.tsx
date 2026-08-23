/**
 * What the platform fee costs in pounds, against what the band charges.
 *
 * Fees get their own block rather than a cell because they are the most
 * durable difference between same-risk portfolios. A year's return is mostly
 * the market; a rate card is a fact about the provider that will still be
 * true in ten years, and it is the one thing on this page a reader can act on
 * with confidence.
 *
 * The ten-year figure is arithmetic on the published rate at a balance held
 * flat — no growth, no contributions, no change to the card, none of which
 * will be true. It exists because a percentage is not legible as money and
 * ten years is long enough to make the charge visible. The copy says exactly
 * that, in as many words, because a projection that looks like a forecast is
 * worse than no projection.
 */
import type { BandCost } from '@/lib/tracker/costBand'
import { PROJECTION_YEARS } from '@/lib/tracker/costBand'
import { formatBps, formatPence } from '@/lib/tracker/money'

export function CostBlock({
  cost,
  modelledBalancePence,
  ocfBps,
}: {
  cost: BandCost
  modelledBalancePence: number
  ocfBps: number | null
}) {
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-x-12 gap-y-8 rounded-2xl border border-border bg-card p-6">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
            This portfolio, a year
          </p>
          <p className="mt-2 text-[30px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
            {formatPence(cost.annualPence)}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {formatBps(cost.feeBps)} on {formatPence(modelledBalancePence)}
          </p>
        </div>

        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
            Over {PROJECTION_YEARS} years
          </p>
          <p className="mt-2 text-[30px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
            {formatPence(cost.projectedPence)}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">at the same balance, held flat</p>
        </div>

        {cost.bandAverageBps !== null ? (
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
              Band average, a year
            </p>
            <p className="mt-2 text-[30px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
              {formatPence(cost.bandAverageAnnualPence!)}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {formatBps(cost.bandLowestBps!)} to {formatBps(cost.bandHighestBps!)} across{' '}
              {cost.peerCount + 1} portfolios
            </p>
          </div>
        ) : null}
      </div>

      {cost.differenceFromAveragePence !== null ? (
        <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-foreground">
          {cost.differenceFromAveragePence === 0
            ? 'That is exactly the band average.'
            : `That is ${formatPence(Math.abs(cost.differenceFromAveragePence))} a year ${
                cost.differenceFromAveragePence > 0 ? 'more' : 'less'
              } than the average of everything tracked at this risk level, at this balance.`}
        </p>
      ) : (
        <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
          Nothing else is tracked at this risk level yet, so there is no band to compare the
          charge against.
        </p>
      )}

      <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
        The {PROJECTION_YEARS}-year figure is arithmetic on the published rate card at a balance
        held flat — not a forecast. It assumes no growth, nothing paid in, and no change to the
        charges, none of which will be true. It is here because a percentage is hard to read as
        money and ten years is long enough to make the charge visible.
        {ocfBps ? (
          <>
            {' '}
            The fund's own ongoing charge of {formatBps(ocfBps)} is not included, because it is
            already inside the unit price the provider publishes — counting it again would
            double it.
          </>
        ) : null}
      </p>
    </div>
  )
}
