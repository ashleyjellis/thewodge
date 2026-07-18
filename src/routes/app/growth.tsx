import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'

export const Route = createFileRoute('/app/growth')({
  head: () => ({
    ...seo({ title: `Growth — ${SITE_NAME}`, description: 'Tracking loop.', path: '/app/growth' }),
    meta: [
      ...seo({ title: `Growth — ${SITE_NAME}`, description: 'Tracking loop.', path: '/app/growth' })
        .meta,
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Growth,
})

function Growth() {
  return (
    <div className="max-w-lg">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Coming next
      </p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-tight">
        Growth
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
        Update your account balances whenever you like — no forced monthly
        cadence — and see what you put in against what the market added. Built in
        the next phase.
      </p>
    </div>
  )
}
