/**
 * Household analysis — the composition layer (spec §3, §4).
 *
 * Assembles the pure primitives into the per-person and combined views the five
 * screens consume, so the UI stays thin. Still pure: no IO, no framework. A
 * `baseYear` is passed in (never read from the clock) so results are deterministic
 * and testable.
 *
 * Pot policy:
 *   - net worth counts all three pots (pension, stocks, cash).
 *   - the investable / compounding view excludes ring-fenced (emergency) cash.
 *   - pension grows at realReturn; stocks at realReturn; cash at cashReturn.
 */
import {
  annualContribution,
  type Household,
  type Person,
  type Pot,
  type PotKind,
} from './types'
import {
  coastFiNumber,
  coastFiStatus,
  fiNumber,
  yearsToRetirement,
  type CoastFiStatus,
} from './fi'
import {
  combineProjections,
  projectPot,
  type ProjectionPoint,
} from './projection'
import { crossoverFromSeries, type Crossover } from './crossover'
import {
  bridgeCheck,
  earliestFiFromSeries,
  type BridgeCheck,
  type EarliestFi,
} from './scenarios'
import { deployedVsGenerated, type DeployedVsGenerated } from './lifetimeValue'

export type AnalyseOptions = {
  /** calendar year "now", for labelling crossover years. Defaults to none. */
  baseYear?: number
}

export type PotAnalysis = {
  kind: PotKind
  value: number
  r: number
  /** projection to this person's retirement */
  projection: ProjectionPoint[]
  finalValue: number
  coast: CoastFiStatus
  crossover: Crossover
  deployed: DeployedVsGenerated
  /** whether this pot is included in the investable/compounding view */
  investable: boolean
}

export type NetWorthSplit = {
  pension: number
  stocks: number
  cash: number
  total: number
}

export type PersonAnalysis = {
  person: Person
  yearsToRetirement: number
  netWorth: NetWorthSplit
  /** investable balance today (excludes ring-fenced cash) */
  investableToday: number
  pension: PotAnalysis
  stocks: PotAnalysis
  cash: PotAnalysis
  /** combined investable projection to this person's retirement */
  investableProjection: ProjectionPoint[]
  investableFinal: number
  /** coast status of all investable pots combined */
  coast: CoastFiStatus
  crossover: Crossover
  earliestFi: EarliestFi
  deployed: DeployedVsGenerated
}

export type HouseholdAnalysis = {
  fi: number
  /** the longest runway across the household (years) */
  horizon: number
  people: PersonAnalysis[]
  combined: {
    netWorth: NetWorthSplit
    investableToday: number
    projection: ProjectionPoint[]
    investableFinal: number
    coast: CoastFiStatus
    crossover: Crossover
    earliestFi: EarliestFi
    deployed: DeployedVsGenerated
  }
}

type InvestableLeg = {
  kind: PotKind
  personIndex: number
  pot: Pot
  r: number
  /** years from now until this person retires (contributions stop after) */
  retiresInYears: number
}

/** All pots that count toward the investable/compounding view. */
export function investableLegs(household: Household): InvestableLeg[] {
  const legs: InvestableLeg[] = []
  household.people.forEach((person, personIndex) => {
    const retiresInYears = yearsToRetirement(
      person.age,
      household.retirementAge,
    )
    legs.push({
      kind: 'pension',
      personIndex,
      pot: person.pension,
      r: household.assumptions.realReturn,
      retiresInYears,
    })
    legs.push({
      kind: 'stocks',
      personIndex,
      pot: person.stocks,
      r: household.assumptions.realReturn,
      retiresInYears,
    })
    if (!person.cash.ringFenced) {
      legs.push({
        kind: 'cash',
        personIndex,
        pot: person.cash,
        r: household.assumptions.cashReturn,
        retiresInYears,
      })
    }
  })
  return legs
}

/** Project a leg to a shared horizon, contributing only until it retires. */
function projectLeg(leg: InvestableLeg, horizon: number): ProjectionPoint[] {
  const base = annualContribution(leg.pot)
  return projectPot(leg.pot, leg.r, horizon, {
    contributionForYear: (y) => (y <= leg.retiresInYears ? base : 0),
  })
}

function netWorth(person: Person): NetWorthSplit {
  const pension = person.pension.value
  const stocks = person.stocks.value
  const cash = person.cash.value
  return { pension, stocks, cash, total: pension + stocks + cash }
}

function analysePot(
  kind: PotKind,
  pot: Pot,
  r: number,
  years: number,
  fi: number,
  investable: boolean,
  baseYear?: number,
): PotAnalysis {
  const projection = projectPot(pot, r, years)
  const final = projection[projection.length - 1]!
  return {
    kind,
    value: pot.value,
    r,
    projection,
    finalValue: final.endValue,
    coast: coastFiStatus(pot, fi, r, years),
    crossover: crossoverFromSeries(projection, baseYear),
    deployed: deployedVsGenerated(
      final.endValue,
      final.cumulativeContribution,
      pot.value,
    ),
    investable,
  }
}

function analysePerson(
  person: Person,
  household: Household,
  fi: number,
  baseYear?: number,
): PersonAnalysis {
  const years = yearsToRetirement(person.age, household.retirementAge)
  const { realReturn, cashReturn } = household.assumptions

  const pension = analysePot(
    'pension',
    person.pension,
    realReturn,
    years,
    fi,
    true,
    baseYear,
  )
  const stocks = analysePot(
    'stocks',
    person.stocks,
    realReturn,
    years,
    fi,
    true,
    baseYear,
  )
  const cash = analysePot(
    'cash',
    person.cash,
    cashReturn,
    years,
    fi,
    !person.cash.ringFenced,
    baseYear,
  )

  const investablePots = [pension, stocks, ...(cash.investable ? [cash] : [])]
  const investableProjection = combineProjections(
    investablePots.map((p) => p.projection),
  )
  const finalPoint = investableProjection[investableProjection.length - 1]!
  const investableToday = investablePots.reduce((s, p) => s + p.value, 0)

  // coast of the combined investable pots. Pension + stocks dominate and both grow
  // at realReturn, so the coast bar uses realReturn; the projection it reads from
  // already blends in cash at its own rate.
  const coast = coastFiStatusFromProjection(
    investableProjection,
    fi,
    realReturn,
    years,
  )

  return {
    person,
    yearsToRetirement: years,
    netWorth: netWorth(person),
    investableToday,
    pension,
    stocks,
    cash,
    investableProjection,
    investableFinal: finalPoint.endValue,
    coast,
    crossover: crossoverFromSeries(investableProjection, baseYear),
    earliestFi: earliestFiFromSeries(investableProjection, fi, person.age),
    deployed: deployedVsGenerated(
      finalPoint.endValue,
      finalPoint.cumulativeContribution,
      investableToday,
    ),
  }
}

/**
 * Coast status derived from an already-combined investable projection. `progress`
 * and `surplus` use the combined starting value; `yearsToCoast` reads the year the
 * projection (which already includes contributions) overtakes the rising coast bar.
 */
function coastFiStatusFromProjection(
  projection: ProjectionPoint[],
  fi: number,
  r: number,
  years: number,
): CoastFiStatus {
  const coastNumber = coastFiNumber(fi, r, years)
  const currentValue = projection[0]!.endValue
  const surplus = currentValue - coastNumber
  const coasting = currentValue >= coastNumber
  const progress = coastNumber > 0 ? Math.min(1, currentValue / coastNumber) : 1

  let yearsToCoast: number | null = coasting ? 0 : null
  if (!coasting) {
    for (const p of projection) {
      if (p.year === 0) continue
      const remaining = years - p.year
      if (remaining < 0) break
      if (p.endValue >= coastFiNumber(fi, r, remaining)) {
        yearsToCoast = p.year
        break
      }
    }
  }

  return { coastNumber, currentValue, coasting, surplus, progress, yearsToCoast }
}

/** Full static analysis of a household. */
export function analyseHousehold(
  household: Household,
  opts: AnalyseOptions = {},
): HouseholdAnalysis {
  const fi = fiNumber(household.targetIncomeToday, household.assumptions.swr)
  const { baseYear } = opts

  const people = household.people.map((p) =>
    analysePerson(p, household, fi, baseYear),
  )

  const horizon = Math.max(...people.map((p) => p.yearsToRetirement), 0)
  const legs = investableLegs(household)
  const combinedProjection = combineProjections(
    legs.map((leg) => projectLeg(leg, horizon)),
  )
  const combinedFinal = combinedProjection[combinedProjection.length - 1]!

  const combinedNet = household.people.reduce<NetWorthSplit>(
    (acc, p) => {
      const n = netWorth(p)
      return {
        pension: acc.pension + n.pension,
        stocks: acc.stocks + n.stocks,
        cash: acc.cash + n.cash,
        total: acc.total + n.total,
      }
    },
    { pension: 0, stocks: 0, cash: 0, total: 0 },
  )

  const investableToday = combinedProjection[0]!.endValue

  return {
    fi,
    horizon,
    people,
    combined: {
      netWorth: combinedNet,
      investableToday,
      projection: combinedProjection,
      investableFinal: combinedFinal.endValue,
      coast: coastFiStatusFromProjection(
        combinedProjection,
        fi,
        household.assumptions.realReturn,
        horizon,
      ),
      crossover: crossoverFromSeries(combinedProjection, baseYear),
      earliestFi: earliestFiFromSeries(
        combinedProjection,
        fi,
        // youngest person's age anchors "at age X"
        Math.min(...household.people.map((p) => p.age)),
      ),
      deployed: deployedVsGenerated(
        combinedFinal.endValue,
        combinedFinal.cumulativeContribution,
        investableToday,
      ),
    },
  }
}

// ── Interactive scenarios (driven by UI sliders) ─────────────────────────────

export type HouseholdStopScenario = {
  stopAge: number
  /** combined investable value at retirement if contributions freeze at stopAge */
  finalValue: number
  /** the full frozen year-by-year series to the household horizon */
  projection: ProjectionPoint[]
  /** the household's combined stocks value at the stop age (the bridge fund) */
  stocksAtStop: number
  /** can stocks alone bridge stopAge → pension access age? */
  bridge: BridgeCheck
}

/**
 * Freeze ALL contributions once the (youngest) person reaches `stopAge`, compound
 * the whole investable base to the household horizon, and check whether the stocks
 * pot alone bridges from the stop to pension access age.
 */
export function householdStopScenario(
  household: Household,
  stopAge: number,
  opts: AnalyseOptions = {},
): HouseholdStopScenario {
  void opts
  const anchorAge = Math.min(...household.people.map((p) => p.age))
  const horizon = Math.max(
    ...household.people.map((p) =>
      yearsToRetirement(p.age, household.retirementAge),
    ),
    0,
  )
  const yearsUntilStop = Math.max(0, Math.min(horizon, stopAge - anchorAge))
  const legs = investableLegs(household)

  const frozen = combineProjections(
    legs.map((leg) => {
      const base = annualContribution(leg.pot)
      return projectPot(leg.pot, leg.r, horizon, {
        contributionForYear: (y) => (y <= yearsUntilStop ? base : 0),
      })
    }),
  )
  const finalValue = frozen[frozen.length - 1]!.endValue
  const projection = frozen

  // stocks-only projection to the stop age (with contributions until the stop)
  const stocksLegs = investableLegs(household).filter((l) => l.kind === 'stocks')
  const stocksAtStopSeries = combineProjections(
    stocksLegs.map((leg) => {
      const base = annualContribution(leg.pot)
      return projectPot(leg.pot, leg.r, yearsUntilStop, {
        contributionForYear: (y) => (y <= yearsUntilStop ? base : 0),
      })
    }),
  )
  const stocksAtStop =
    stocksAtStopSeries.length > 0
      ? stocksAtStopSeries[stocksAtStopSeries.length - 1]!.endValue
      : 0

  return {
    stopAge,
    finalValue,
    projection,
    stocksAtStop,
    bridge: bridgeCheck(
      stocksAtStop,
      household.targetIncomeToday,
      stopAge,
      household.assumptions.realReturn,
    ),
  }
}
