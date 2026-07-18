/**
 * Per-screen scaffold for the signed-in arc. Header (back + step position), the
 * screen's eyebrow/title, the content, then the always-reachable Assumptions panel
 * and the permanent not-advice line, with a single sticky CTA. Keeps every screen
 * conformant to the brand guide without repetition.
 */
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/cn'
import { STEPS } from '@/lib/appNav'
import { Eyebrow, NotAdviceLine, Wordmark } from './brand'
import { AssumptionsPanel } from './AssumptionsPanel'
import { primaryButtonClass } from './PrimaryButton'
import { NavLink } from './NavLink'

export function AppScreen({
  stepIndex,
  children,
  next,
  backTo,
}: {
  /** 0-based index into STEPS, or null for off-arc screens (e.g. tracking) */
  stepIndex: number | null
  children: ReactNode
  next?: { to: string; label: string }
  backTo?: string
}) {
  const resolvedBack =
    backTo ??
    (stepIndex !== null && stepIndex > 0 ? STEPS[stepIndex - 1]!.path : '/')
  const step = stepIndex !== null ? STEPS[stepIndex] : null

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-[420px] px-5 pb-40 pt-6">
        <header className="flex items-center justify-between">
          <NavLink
            to={resolvedBack}
            ariaLabel="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </NavLink>
          <StepDots active={stepIndex} />
          <Wordmark className="text-muted-foreground" />
        </header>

        {step ? (
          <div className="mt-8">
            <Eyebrow>{step.eyebrow}</Eyebrow>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">
              {step.title}
            </h1>
          </div>
        ) : null}

        <div className="mt-6 space-y-8">{children}</div>

        <div className="mt-8">
          <AssumptionsPanel />
        </div>

        <div className="mt-6">
          <NotAdviceLine />
        </div>
      </div>

      {next ? (
        <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background from-55% to-transparent pb-6 pt-10">
          <div className="mx-auto max-w-[420px] px-5">
            <NavLink to={next.to} className={primaryButtonClass}>
              {next.label}
            </NavLink>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function StepDots({ active }: { active: number | null }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {STEPS.map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            i === active ? 'bg-foreground' : 'bg-muted-foreground/25',
          )}
        />
      ))}
    </div>
  )
}
