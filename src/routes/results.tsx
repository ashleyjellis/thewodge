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
import { MaxWidthContainer } from '@/components/site/Container'
import { Calculator } from '@/components/calculator/Calculator'
import { ForecastResults } from '@/components/results/ForecastResults'
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

  const onSubmit = (values: CalculatorSearch) => {
    void navigate({ to: '/results', search: toSearch(values) })
  }

  return (
    <MaxWidthContainer className="py-12 lg:py-16">
      {ready ? (
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
            result={forecast(toForecastInput(search))}
          />

          <div className="mt-10 border-t border-border/60 pt-10">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Adjust your numbers
            </h2>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Change anything — your trajectory updates. Your inputs live in the
              page’s address, so you can bookmark or share this view.
            </p>
            <div className="mt-5 max-w-xl">
              <Calculator
                initial={search}
                onSubmit={onSubmit}
                submitLabel="Update"
              />
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
            <Calculator initial={search} onSubmit={onSubmit} />
          </div>
        </div>
      )}
    </MaxWidthContainer>
  )
}
