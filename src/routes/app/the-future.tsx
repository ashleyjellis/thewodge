import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useHousehold } from '@/state/household'
import { householdStopScenario } from '@/lib/calc/household'
import type { ProjectionPoint } from '@/lib/calc/projection'
import { money } from '@/lib/format'
import { AppScreen } from '@/components/AppScreen'
import { Card, HeroFigure, Muted, Eyebrow, SectionHeading } from '@/components/brand'
import { Segmented } from '@/components/Segmented'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { cn } from '@/lib/cn'
import { STEPS } from '@/lib/appNav'

export const Route = createFileRoute('/app/the-future')({
  component: TheFuture,
})

const MILESTONES = [
  { value: 250_000, label: '£250k' },
  { value: 500_000, label: '£500k' },
  { value: 1_000_000, label: '£1m' },
]

function TheFuture() {
  const { household, analysis, baseYear } = useHousehold()
  const anchorAge = Math.min(...household.people.map((p) => p.age))

  const stopAges = [40, 45, 50, 55, 60].filter(
    (a) => a > anchorAge + 1 && a < household.retirementAge,
  ).slice(0, 3)

  const [choice, setChoice] = useState<string>('keep')

  const series: ProjectionPoint[] = useMemo(() => {
    if (choice === 'keep') return analysis.combined.projection
    return householdStopScenario(household, Number(choice)).projection
  }, [choice, household, analysis])

  const keepFinal = analysis.combined.investableFinal
  const finalValue = series[series.length - 1]?.endValue ?? 0
  const coastNumber = analysis.combined.coast.coastNumber
  const crossoverYear = analysis.combined.crossover.year

  // first year each milestone / Coast FI is crossed
  const tags = useMemo(() => {
    const map = new Map<number, string[]>()
    const add = (year: number, label: string) => {
      map.set(year, [...(map.get(year) ?? []), label])
    }
    const thresholds = [
      ...MILESTONES,
      { value: coastNumber, label: 'Coast FI' },
    ].sort((a, b) => a.value - b.value)
    const crossed = new Set<string>()
    for (const pt of series) {
      for (const t of thresholds) {
        if (!crossed.has(t.label) && pt.endValue >= t.value && pt.year > 0) {
          crossed.add(t.label)
          add(pt.year, t.label)
        }
      }
    }
    if (crossoverYear && crossoverYear > 0) add(crossoverYear, 'market pulls ahead')
    return map
  }, [series, coastNumber, crossoverYear])

  const options = [
    { label: 'Keep going', value: 'keep' },
    ...stopAges.map((a) => ({ label: `Stop at ${a}`, value: String(a) })),
  ]

  return (
    <AppScreen
      stepIndex={3}
      next={{ to: STEPS[4]!.path, label: 'So what am I free to do? →' }}
    >
      <Card>
        <Eyebrow>at {household.retirementAge}, in today’s money</Eyebrow>
        <HeroFigure className="mt-3">{money(finalValue)}</HeroFigure>
        <Muted className="mt-2">
          {choice === 'keep'
            ? 'if you keep contributing as you do now.'
            : `even if you stopped adding a penny at ${choice} — ${money(
                keepFinal - finalValue,
              )} less than carrying on.`}
        </Muted>

        <div className="mt-6">
          <Segmented
            ariaLabel="Contribution scenario"
            options={options}
            value={choice}
            onChange={setChoice}
          />
        </div>
      </Card>

      <Card>
        <SectionHeading>Year by year</SectionHeading>
        <Muted className="mt-2">Every year to {household.retirementAge}, with the milestones marked.</Muted>
        <div className="mt-4 max-h-[380px] overflow-y-auto">
          <table className="w-full text-[13px] tabular-nums">
            <thead className="sticky top-0 bg-card text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Age</th>
                <th className="py-2 text-right font-medium">Pot</th>
                <th className="py-2 pl-3 font-medium">Milestone</th>
              </tr>
            </thead>
            <tbody>
              {series.map((pt) => {
                const rowTags = tags.get(pt.year)
                return (
                  <tr
                    key={pt.year}
                    className={cn(
                      'border-t border-border',
                      rowTags ? 'bg-accent/30' : undefined,
                    )}
                  >
                    <td className="py-2 text-muted-foreground">
                      {anchorAge + pt.year}
                      <span className="ml-1 text-[11px] text-muted-foreground/70">
                        {baseYear + pt.year}
                      </span>
                    </td>
                    <td className="py-2 text-right font-semibold">
                      {money(pt.endValue)}
                    </td>
                    <td className="py-2 pl-3">
                      {rowTags ? (
                        <span className="text-[12px] text-foreground">
                          {rowTags.join(' · ')}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <HowWeWorkedThisOut className="mt-6">
          <Working
            formula="Each year: (previous pot + this year’s contribution) grows by your real return."
            numbers={`stop-at scenarios freeze contributions at the chosen age, then the pot simply compounds to ${household.retirementAge}.`}
          />
        </HowWeWorkedThisOut>
      </Card>
    </AppScreen>
  )
}
