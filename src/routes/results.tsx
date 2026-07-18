import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { forecast } from '@/lib/forecast'
import {
  canForecast,
  toForecastInput,
  toSearch,
  validateCalculatorSearch,
  type CalculatorSearch,
} from '@/lib/search'
import type { HookId } from '@/lib/hooks'
import { percent } from '@/lib/format'
import { MaxWidthContainer } from '@/components/site/Container'
import { Calculator } from '@/components/calculator/Calculator'
import { ForecastResults } from '@/components/results/ForecastResults'
import { AssumptionRow } from '@/components/results/AssumptionRow'
import { PartnerCta } from '@/components/results/PartnerCta'
import { HookModal } from '@/components/results/HookModal'
import { NavLink } from '@/components/NavLink'

const resultsSeo = seo({
  title: `Your trajectory — ${SITE_NAME}`,
  description:
    'Your pension, investments and cash carried forward — the consequences of your own numbers.',
  path: '/results',
})

export const Route = createFileRoute('/results')({
  validateSearch: validateCalculatorSearch,
  head: () => ({
    links: resultsSeo.links,
    // user-specific results — keep them out of the index
    meta: [...resultsSeo.meta, { name: 'robots', content: 'noindex' }],
  }),
  component: Results,
})

function Results() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const ready = canForecast(search)
  const [activeHook, setActiveHook] = useState<HookId | null>(null)

  const onSubmit = (values: CalculatorSearch) => {
    void navigate({ to: '/results', search: toSearch(values) })
  }

  const result = ready ? forecast(toForecastInput(search)) : null

  return (
    <MaxWidthContainer className="py-12 lg:py-16">
      {ready && result ? (
        <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Your trajectory
              </p>
              <h1 className="mt-2 text-[28px] font-semibold tracking-tight sm:text-[34px]">
                The whole picture, carried forward
              </h1>
            </div>
            <NavLink
              to="/guides"
              className="text-[14px] font-medium text-foreground underline underline-offset-4"
            >
              Explore the guides →
            </NavLink>
          </div>

          <ForecastResults
            input={toForecastInput(search)}
            result={result}
            onOpenHook={setActiveHook}
          />

          <div className="mt-10 border-t border-border/60 pt-10">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Adjust your numbers
            </h2>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Change anything — your trajectory updates. Your inputs live in the
              page’s address, so you can bookmark or share this view.
            </p>
            <div className="mt-5 max-w-2xl">
              <Calculator
                initial={search}
                onSubmit={onSubmit}
                submitLabel="Update"
                variant="full"
              />
            </div>

            <div className="mt-6 max-w-2xl">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                What we’ve assumed
              </p>
              <div className="mt-3 space-y-2">
                <AssumptionRow
                  label="Investment growth"
                  value={`${percent(result.assumptions.investedRate)} a year, assumed for everyone`}
                  onClick={() => setActiveHook('invested-rate')}
                />
                <AssumptionRow
                  label="Cash growth"
                  value={`${percent(result.assumptions.cashRate)} a year, assumed for everyone`}
                  onClick={() => setActiveHook('cash-rate')}
                />
                {result.pensionContributionBasis === 'assumed' ? (
                  <AssumptionRow
                    label="Pension contribution"
                    value="6% employer + 6% you, assumed from your income"
                    onClick={() => setActiveHook('employer-split')}
                  />
                ) : null}
              </div>

              <div className="mt-3">
                <PartnerCta onClick={() => setActiveHook('partner')} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-xl py-8 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight">
            Add your numbers to see your trajectory
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Your age and at least one pot are enough to begin. Nothing is saved or
            sent.
          </p>
          <div className="mt-8 text-left">
            <Calculator initial={search} onSubmit={onSubmit} variant="full" />
          </div>
        </div>
      )}

      <HookModal hookId={activeHook} onClose={() => setActiveHook(null)} />
    </MaxWidthContainer>
  )
}
