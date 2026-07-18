import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { MaxWidthContainer } from '@/components/site/Container'
import { NavLink } from '@/components/NavLink'

/**
 * Placeholder auth boundary. v1 has no accounts, so this always reports
 * "signed out". When real auth arrives, resolve the session here (e.g. in
 * beforeLoad) and gate the logged-in snapshot ritual behind it.
 */
function getSession(): { email: string } | null {
  return null
}

/**
 * Every product hook (locked-assumption rows, the partner CTA, the save-forecast
 * closer) links here with `?from=<hookId>` so this stub can acknowledge what
 * brought someone here. This is cosmetic only — no destination screen is built;
 * the real post-login journey picks up from this context later.
 */
const FROM_COPY: Record<string, string> = {
  'cash-rate': 'You wanted to set your own cash rate.',
  'invested-rate': 'You wanted to set your own investment rate.',
  'employer-split': 'You wanted to enter your real pension contribution.',
  partner: 'You wanted to add your partner.',
  'save-forecast': 'You wanted to save your forecast.',
}

export const Route = createFileRoute('/app')({
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  head: () => ({
    ...seo({
      title: `Your space — ${SITE_NAME}`,
      description: 'The logged-in snapshot ritual — coming later.',
      path: '/app',
    }),
    meta: [
      ...seo({
        title: `Your space — ${SITE_NAME}`,
        description: 'The logged-in snapshot ritual — coming later.',
        path: '/app',
      }).meta,
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AppStub,
})

function AppStub() {
  const session = getSession()
  const { from } = Route.useSearch()
  const fromLine = from ? FROM_COPY[from] : undefined

  return (
    <MaxWidthContainer className="py-24">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Coming later
        </p>
        <h1 className="mt-3 text-[30px] font-semibold tracking-tight">
          {session ? 'Your saved snapshots' : 'A quiet place to check in'}
        </h1>
        {fromLine ? (
          <p className="mt-4 text-[16px] leading-relaxed text-foreground">
            {fromLine} That’s exactly the kind of thing an account will unlock —
            it’s just not built yet.
          </p>
        ) : null}
        <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
          Later, {SITE_NAME} will let you save a snapshot of your picture and
          return to see how the trajectory has moved — the same calm view, over
          time. No comparison to anyone, only to your own past self.
        </p>
        <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
          For now, the calculator is completely stateless and needs no account.
        </p>
        <div className="mt-8">
          <NavLink
            to="/"
            hash="calculator"
            className="inline-flex items-center rounded-full bg-foreground px-5 py-3 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
          >
            Check your trajectory
          </NavLink>
        </div>
      </div>
    </MaxWidthContainer>
  )
}
