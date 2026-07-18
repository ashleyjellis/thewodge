/**
 * Education card (spec §3, §9) — public mechanics only, zero advice. Surfaces the
 * two education helpers: the value of an employer's pension contribution ("free
 * money") and the £100k personal-allowance trap. States the maths and the public
 * rule; never says "you should".
 */
import type { Household } from '@/lib/calc/types'
import { employerMatchValue, personalAllowanceTrap } from '@/lib/calc/education'
import { money, percent } from '@/lib/format'
import { Card, Muted, SectionHeading } from './brand'
import { StatRow } from './StatRow'
import { HowWeWorkedThisOut, Working } from './HowWeWorkedThisOut'

export function EducationCard({ household }: { household: Household }) {
  const people = household.people

  return (
    <Card>
      <SectionHeading>What the system adds</SectionHeading>
      <Muted className="mt-2">
        Two public mechanics worth knowing — the maths, not a recommendation.
      </Muted>

      <div className="mt-5 space-y-3">
        {people.map((p, i) => {
          const match = employerMatchValue(p.salary, p.employerPension)
          return (
            <StatRow
              key={`match-${i}`}
              tone="market"
              label={`${p.name}’s employer adds`}
              value={`${money(match.employerAnnual)}/yr`}
              sub="free money, if they contribute"
            />
          )
        })}
      </div>

      {people.some((p) => {
        const t = personalAllowanceTrap(
          p.salary,
          p.bonus,
          employerMatchValue(p.salary, p.employerPension).employeeAnnual,
        )
        return t.inTrap
      }) ? (
        <div className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          {people
            .filter((p) => {
              const t = personalAllowanceTrap(
                p.salary,
                p.bonus,
                employerMatchValue(p.salary, p.employerPension).employeeAnnual,
              )
              return t.inTrap
            })
            .map((p) => {
              const t = personalAllowanceTrap(
                p.salary,
                p.bonus,
                employerMatchValue(p.salary, p.employerPension).employeeAnnual,
              )
              return (
                <p key={p.name}>
                  {p.name}’s income of {money(t.adjustedNetIncome)} sits in the
                  £100,000–£125,140 band, where every £1 is taxed at about{' '}
                  {percent(t.effectiveMarginalRate)} as the personal allowance
                  tapers away. Pension contributions reduce adjusted net income
                  £-for-£.
                </p>
              )
            })}
        </div>
      ) : null}

      <HowWeWorkedThisOut className="mt-6">
        <Working
          formula="Employer contribution = salary × (employer match % + any additional %)."
          numbers={people
            .map((p) => {
              const m = employerMatchValue(p.salary, p.employerPension)
              return `${p.name}: ${money(p.salary)} × ${percent(p.employerPension.matchPct + p.employerPension.additionalPct)} = ${money(m.employerAnnual)}`
            })
            .join('  ·  ')}
        />
        <p>
          The £100k trap and personal allowance taper (£12,570, withdrawn £1 per
          £2 over £100,000, gone at £125,140) are HMRC rules for 2025/26.
        </p>
      </HowWeWorkedThisOut>
    </Card>
  )
}
