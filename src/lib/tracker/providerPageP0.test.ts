/**
 * The provider page's data-integrity acceptance tests.
 *
 * These exist because the page publishes numbers as verified fact, and an
 * internal contradiction on it is worse than a missing feature. Every case
 * here is a way the page could disagree with itself while every individual
 * figure remained defensible in isolation.
 *
 * Built on the real demo dataset rather than hand-made fixtures. A fixture
 * chosen to make a rounding identity hold proves only that the fixture was
 * chosen well; the whole class of bug here is one that appears at a
 * particular scale, with particular numbers, after a particular rounding.
 */
import { describe, expect, it } from 'vitest'
import { buildDemoDataset } from './demoData'
import {
  buildLedgerRows,
  buildProviderPageView,
  netPeerReturn,
  peerFeeBps,
  summarisePeerBand,
  type Peer,
} from './providerPage'
import { barGeometry } from '../../components/tracker/PeerBars'
import { formatReturn } from './money'

const REFERENCE = '2026-08-23'
const dataset = buildDemoDataset(REFERENCE)

/** The brief's reference portfolio. */
function reference() {
  const found = dataset.portfolios.find(
    (p) => p.providerSlug === 'aldworth' && p.slug === 'fully-managed-adventurous',
  )
  if (!found) throw new Error('reference portfolio missing from the demo dataset')
  return found
}

function viewAt(modelledBalancePence: number, feesDeducted: boolean) {
  const p = reference()
  return buildProviderPageView(
    {
      inceptionDate: p.inceptionDate,
      initialPence: p.initialPence,
      platformFeeBps: p.platformFeeBps,
      feeTiersJson: p.feeTiersJson,
      ocfBps: p.ocfBps,
    },
    p.readings,
    p.flows,
    { feesDeducted, modelledBalancePence },
  )
}

const TWENTY_K = 2_000_000

describe('P0 acceptance 1 — the fee toggle moves every figure together', () => {
  const gross = viewAt(TWENTY_K, false)
  const net = viewAt(TWENTY_K, true)

  it('changes the headline', () => {
    expect(net.scaledCurrentPence).toBeLessThan(gross.scaledCurrentPence)
  })

  it('changes both return figures', () => {
    expect(net.twr!).toBeLessThan(gross.twr!)
    expect(net.simple!).toBeLessThan(gross.simple!)
  })

  it('leaves the opening position untouched — a fee cannot apply before day one', () => {
    expect(net.scaledOpeningPence).toBe(gross.scaledOpeningPence)
    expect(net.series[0]!.unitPriceMicro).toBe(gross.series[0]!.unitPriceMicro)
  })

  it('moves the peer band figure with the headline, not against it', () => {
    // The self row is the view's own twr, so this is true by construction —
    // asserted anyway, because the construction is exactly what regressed.
    const bandGross = summarisePeerBand(
      [{ label: 'This portfolio', returnFraction: gross.twr!, isSelf: true }],
      'provider_risk_label',
    )!
    const bandNet = summarisePeerBand(
      [{ label: 'This portfolio', returnFraction: net.twr!, isSelf: true }],
      'provider_risk_label',
    )!
    expect(bandGross.self).toBe(gross.twr)
    expect(bandNet.self).toBe(net.twr)
    expect(bandNet.self!).toBeLessThan(bandGross.self!)
  })
})

describe('P0 acceptance 2 — gross minus fees equals net, to the penny', () => {
  // The one arithmetic check a sceptical reader actually performs.
  for (const balance of [10_000, 50_000, TWENTY_K, 500_000, 25_000_000]) {
    for (const feesDeducted of [false, true]) {
      it(`holds at ${balance}p with fees ${feesDeducted ? 'on' : 'off'}`, () => {
        const view = viewAt(balance, feesDeducted)
        expect(view.scaledGrossCurrentPence - view.feesSoFarPence).toBe(
          view.scaledNetCurrentPence,
        )
      })
    }
  }

  it('reports the same fee in both toggle states — it is what was borne, not a view', () => {
    expect(viewAt(TWENTY_K, false).feesSoFarPence).toBe(viewAt(TWENTY_K, true).feesSoFarPence)
  })

  it('shows the toggle selecting between exactly those two figures', () => {
    expect(viewAt(TWENTY_K, false).scaledCurrentPence).toBe(
      viewAt(TWENTY_K, false).scaledGrossCurrentPence,
    )
    expect(viewAt(TWENTY_K, true).scaledCurrentPence).toBe(
      viewAt(TWENTY_K, true).scaledNetCurrentPence,
    )
  })

  it('would have failed before the fix, which scaled the fee on its own path', () => {
    // The old derivation: take the fee at real-account scale, multiply by the
    // balance ratio. Kept here as the thing being guarded against — at
    // £20,000 it lands 14p away from the difference the page displays.
    const view = viewAt(TWENTY_K, true)
    const p = reference()
    const realScaleFee =
      viewAt(p.initialPence, false).scaledGrossCurrentPence -
      viewAt(p.initialPence, true).scaledNetCurrentPence
    const oldWay = Math.round(realScaleFee * (TWENTY_K / p.initialPence))
    expect(oldWay).not.toBe(view.feesSoFarPence)
  })
})

/** The rows the table actually renders — not the view behind it. */
function rowsAt(modelledBalancePence: number, feesDeducted: boolean) {
  const view = viewAt(modelledBalancePence, feesDeducted)
  return buildLedgerRows(view.series, reference().readings, view.scale)
}

describe('P0 acceptance 3 — the ledger opens at inception and reconciles', () => {
  const rows = rowsAt(TWENTY_K, false)

  it('makes the first row the opening position', () => {
    expect(rows[0]!.isOpening).toBe(true)
    expect(rows[0]!.onDate).toBe(reference().inceptionDate)
  })

  it('opens at a unit price of exactly 1.000000', () => {
    expect(rows[0]!.unitPriceMicro).toBe(1_000_000)
  })

  it('opens at the initial investment, restated at the modelled balance', () => {
    expect(rows[0]!.scaledValuePence).toBe(TWENTY_K)
  })

  it('shows no week change and no read date on the opening row', () => {
    expect(rows[0]!.weekMove).toBeNull()
    expect(rows[0]!.readOn).toBeNull()
    expect(rows[0]!.source).toBe('opening position')
  })

  it('has exactly one opening row', () => {
    expect(rows.filter((row) => row.isOpening)).toHaveLength(1)
  })

  it('lets a reader divide the last row by the first and get the headline return', () => {
    // The failure this replaced: the table started at the first observation,
    // so this arithmetic gave +18.50% against a +20.58% headline.
    for (const feesDeducted of [false, true]) {
      const table = rowsAt(TWENTY_K, feesDeducted)
      const first = table[0]!.unitPriceMicro
      const last = table[table.length - 1]!.unitPriceMicro
      expect(formatReturn(last / first - 1)).toBe(
        formatReturn(viewAt(TWENTY_K, feesDeducted).twr!),
      )
    }
  })

  it('gives the first observation a week change, now that it has a row before it', () => {
    expect(rows[1]!.weekMove).not.toBeNull()
  })
})

describe('P0 acceptance 4 — the modelled balance rescales everything together', () => {
  it('rescales the ledger values with the headline', () => {
    const at20k = rowsAt(TWENTY_K, false)
    const at5k = rowsAt(500_000, false)

    const last20k = at20k[at20k.length - 1]!.scaledValuePence
    const last5k = at5k[at5k.length - 1]!.scaledValuePence
    expect(last20k / last5k).toBeCloseTo(4, 3)
    expect(at20k[0]!.scaledValuePence).toBe(TWENTY_K)
    expect(at5k[0]!.scaledValuePence).toBe(500_000)
  })

  it('leaves the unit price alone — it is scale-invariant', () => {
    expect(rowsAt(500_000, false).map((r) => r.unitPriceMicro)).toEqual(
      rowsAt(TWENTY_K, false).map((r) => r.unitPriceMicro),
    )
  })

  it('does not leave the ledger at the real account scale', () => {
    // The failure this replaced: headline restated at £20,000 while the value
    // column still read £508.80, so the two described different portfolios.
    const p = reference()
    const rows = rowsAt(TWENTY_K, false)
    const lastReal = p.readings[p.readings.length - 1]!.valuePence
    expect(rows[rows.length - 1]!.scaledValuePence).not.toBe(lastReal)
    expect(rows[rows.length - 1]!.scaledValuePence).toBeGreaterThan(lastReal * 10)
  })

  it('lands the last row exactly on the headline, at every balance and both fee states', () => {
    // Acceptance 6 in its sharpest form. The naive rescale — stored value
    // times the ratio — put £24,116.40 in this row under a £24,116.54
    // headline, because the stored value was already rounded to whole pence
    // at the real account's size before being multiplied by forty.
    for (const balance of [50_000, 500_000, TWENTY_K, 25_000_000]) {
      for (const feesDeducted of [false, true]) {
        const rows = rowsAt(balance, feesDeducted)
        expect(
          rows[rows.length - 1]!.scaledValuePence,
          `last ledger row must equal the headline at ${balance}p, fees ${feesDeducted}`,
        ).toBe(viewAt(balance, feesDeducted).scaledCurrentPence)
      }
    }
  })

  it('still steps the value up when money is paid in', () => {
    // The other way to make the row match the headline is to price the
    // modelled balance directly, which would erase contributions from the
    // ledger entirely — losing most of what the ledger is for.
    const withFlows = dataset.portfolios.find(
      (p) => p.flows.filter((f) => f.kind !== 'initial').length > 0,
    )
    if (!withFlows) throw new Error('demo dataset has no portfolio with contributions')

    const view = buildProviderPageView(
      {
        inceptionDate: withFlows.inceptionDate,
        initialPence: withFlows.initialPence,
        platformFeeBps: withFlows.platformFeeBps,
        feeTiersJson: withFlows.feeTiersJson,
        ocfBps: withFlows.ocfBps,
      },
      withFlows.readings,
      withFlows.flows,
      { feesDeducted: false, modelledBalancePence: TWENTY_K },
    )
    const rows = buildLedgerRows(view.series, withFlows.readings, view.scale)

    // Units change across the contribution, so the value must not simply
    // track the unit price.
    const unitCounts = new Set(view.series.map((p) => p.unitsMicro))
    expect(unitCounts.size).toBeGreaterThan(1)

    const pricedBalanceOnly = rows.map((r) => Math.round(TWENTY_K * (r.unitPriceMicro / 1_000_000)))
    expect(rows.map((r) => r.scaledValuePence)).not.toEqual(pricedBalanceOnly)
  })
})

describe('P0 acceptance 5 — a negative band member renders from zero, downward', () => {
  const min = -0.1879
  const max = 0.2362

  it('draws a loss on the opposite side of zero from a gain', () => {
    const loss = barGeometry(-0.1879, min, max)
    const gain = barGeometry(0.2362, min, max)
    const zero = ((0 - min) / (max - min)) * 100

    // The loss ends where zero is; the gain starts there.
    expect(loss.leftPct + loss.widthPct).toBeCloseTo(zero, 6)
    expect(gain.leftPct).toBeCloseTo(zero, 6)
  })

  it('does not draw a bigger loss as if it were a bigger gain', () => {
    // The failure this replaced: width from the absolute value, so -10% drew
    // longer than +6% and in the same direction.
    const smallLoss = barGeometry(-0.02, min, max)
    const bigGain = barGeometry(0.2, min, max)
    expect(smallLoss.leftPct).toBeLessThan(bigGain.leftPct)
  })

  it('keeps a near-zero value visible rather than vanishing', () => {
    expect(barGeometry(0, min, max).widthPct).toBeGreaterThan(0)
  })
})

describe('P0 acceptance 6 — no figure appears twice with two different values', () => {
  it('the peer self figure IS the headline figure, not a second calculation', () => {
    for (const feesDeducted of [false, true]) {
      const view = viewAt(TWENTY_K, feesDeducted)
      const peers: Peer[] = [
        { label: 'This portfolio', returnFraction: view.twr!, isSelf: true },
        { label: 'Someone else', returnFraction: 0.05, isSelf: false },
      ]
      const summary = summarisePeerBand(peers, 'provider_risk_label')!
      expect(summary.self).toBe(view.twr)
      expect(formatReturn(summary.self!)).toBe(formatReturn(view.twr!))
    }
  })

  it('applies a peer’s own fee over its own run, matching how the page treats itself', () => {
    // A peer on the same 0.75% card over the same days must land on the same
    // drag this portfolio does — otherwise the band compares unlike with
    // unlike while looking entirely consistent.
    const gross = viewAt(TWENTY_K, false)
    const net = viewAt(TWENTY_K, true)
    const p = reference()

    const modelled = netPeerReturn(gross.twr!, p.platformFeeBps, gross.daysRunning)
    // Within a hundredth of a percentage point: the page rounds the net unit
    // price to whole micro-units, this does not.
    expect(Math.abs(modelled - net.twr!)).toBeLessThan(0.0001)
  })

  it('reads a peer’s fee rate from its own card, not from this portfolio’s', () => {
    const tiered: Peer = {
      label: 'Tiered provider',
      returnFraction: 0.1,
      isSelf: false,
      platformFeeBps: 45,
      feeTiersJson: JSON.stringify([
        { upto_pence: 1_000_000, bps: 90 },
        { upto_pence: null, bps: 20 },
      ]),
    }
    expect(peerFeeBps(tiered, 500_000)).toBe(90)
    expect(peerFeeBps(tiered, 5_000_000)).toBe(20)
    // No tiers at all falls back to the flat rate.
    expect(peerFeeBps({ ...tiered, feeTiersJson: null }, 5_000_000)).toBe(45)
  })

  it('leaves a peer alone when it charges nothing', () => {
    expect(netPeerReturn(0.1, 0, 365)).toBe(0.1)
    expect(netPeerReturn(0.1, null, 365)).toBe(0.1)
    expect(netPeerReturn(0.1, 75, 0)).toBe(0.1)
  })
})
