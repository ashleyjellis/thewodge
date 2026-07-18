import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'

export const Route = createFileRoute('/app/forecast')({
  head: () => ({
    ...seo({
      title: `Forecast — ${SITE_NAME}`,
      description: 'Baseline vs actuals vs replan.',
      path: '/app/forecast',
    }),
    meta: [
      ...seo({
        title: `Forecast — ${SITE_NAME}`,
        description: 'Baseline vs actuals vs replan.',
        path: '/app/forecast',
      }).meta,
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Forecast,
})

function Forecast() {
  return (
    <div className="max-w-lg">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Coming later
      </p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-tight">
        Forecast
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
        Your plan, how reality is tracking against it, and a deliberate replan
        when life changes — with the original baseline always kept visible.
        Built in a later phase.
      </p>
    </div>
  )
}
