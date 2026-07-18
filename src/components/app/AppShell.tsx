/**
 * The authenticated area's own chrome — distinct from the marketing site's
 * SiteHeader/SiteFooter. A slim tab bar (Accounts / Growth / Forecast), Insights
 * reserved but not built (spec §1 — greyed, not wired up). No footer; this is a
 * working tool, not a content page.
 */
import type { ReactNode } from 'react'
import { useState } from 'react'
import { X } from 'lucide-react'
import { SITE_NAME } from '@/config'
import { NavLink } from '@/components/NavLink'
import { MaxWidthContainer } from '@/components/site/Container'

const TABS = [
  { to: '/app/accounts', label: 'Accounts' },
  { to: '/app/growth', label: 'Growth' },
  { to: '/app/forecast', label: 'Forecast' },
]

/** Every product hook on the free tool links here with ?from=<hookId> (spec:
 *  "this session can pick up from context later"). Cosmetic only — no bridge
 *  logic, just a one-line acknowledgement, dismissible, shown once. */
const FROM_COPY: Record<string, string> = {
  'cash-rate': 'You wanted to set your own cash rate.',
  'invested-rate': 'You wanted to set your own investment rate.',
  'employer-split': 'You wanted to enter your real pension contribution.',
  partner: 'You wanted to add your partner.',
  'save-forecast': 'You wanted to save your forecast.',
}

export function AppShell({
  children,
  fromHook,
}: {
  children: ReactNode
  fromHook?: string
}) {
  const [dismissed, setDismissed] = useState(false)
  const fromLine = fromHook ? FROM_COPY[fromHook] : undefined

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <MaxWidthContainer>
          <div className="flex h-16 items-center justify-between gap-3 sm:gap-6">
            <NavLink
              to="/"
              className="shrink-0 text-[15px] font-semibold tracking-tight text-foreground"
              ariaLabel={`${SITE_NAME} home`}
            >
              {SITE_NAME}
            </NavLink>

            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className="shrink-0 rounded-full px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-4"
                  activeClassName="bg-accent/50 text-foreground"
                >
                  {tab.label}
                </NavLink>
              ))}
              <span
                className="shrink-0 cursor-default rounded-full px-3 py-2 text-[14px] font-medium text-muted-foreground/40 sm:px-4"
                aria-disabled="true"
                title="Coming later"
              >
                Insights
              </span>
            </nav>
          </div>
        </MaxWidthContainer>
      </header>

      {fromLine && !dismissed ? (
        <MaxWidthContainer className="pt-4">
          <div className="flex items-start justify-between gap-3 rounded-2xl bg-accent/30 px-4 py-3 text-[13px] text-foreground">
            <p>
              {fromLine} That’s exactly the kind of thing this space is for.
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={16} strokeWidth={2.25} />
            </button>
          </div>
        </MaxWidthContainer>
      ) : null}

      <MaxWidthContainer className="py-8 lg:py-10">{children}</MaxWidthContainer>
    </div>
  )
}
