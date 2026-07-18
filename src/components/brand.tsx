/**
 * Brand primitives (LOCKED brand guide). Semantic tokens only — no hardcoded hex.
 * Navy = "you", accent = "market/world". One shadow token: shadow-soft.
 */
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

/** iPhone-first frame: single column, max-w-[420px], centred, warm canvas. */
export function Screen({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className={cn('mx-auto max-w-[420px] px-5', className)}>
        {children}
      </div>
    </main>
  )
}

/** Raised surface: rounded-3xl, soft shadow, generous padding. */
export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-3xl bg-card p-7 shadow-soft', className)}>
      {children}
    </div>
  )
}

/** 11px uppercase, wide tracking, muted. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  )
}

/** 13px uppercase wordmark. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'text-[13px] font-semibold uppercase tracking-[0.14em]',
        className,
      )}
    >
      The&nbsp;Wodge
    </span>
  )
}

/** 15px card title. */
export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2 className={cn('text-[15px] font-semibold tracking-tight', className)}>
      {children}
    </h2>
  )
}

/** 56px hero number — settled, calm, tabular. */
export function HeroFigure({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-[56px] font-semibold leading-none tracking-tight tabular-nums',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Supporting copy — muted, relaxed. */
export function Muted({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'text-[13px] leading-relaxed text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  )
}

/** Reserved italic closer for reassurance lines. */
export function Closer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn('text-sm italic leading-relaxed', className)}>{children}</p>
  )
}

/** 36×36 back button. Lucide, strokeWidth 2.25. Navigation affordance only. */
export function BackButton({
  onClick,
  href,
  label = 'Back',
}: {
  onClick?: () => void
  href?: string
  label?: string
}) {
  const cls =
    'flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted'
  const icon = <ArrowLeft size={20} strokeWidth={2.25} />
  if (href) {
    return (
      <a href={href} aria-label={label} className={cls}>
        {icon}
      </a>
    )
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {icon}
    </button>
  )
}

/**
 * The permanent, plain-English not-advice line (spec §0). Must be visible on the
 * tool throughout.
 */
export function NotAdviceLine({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'text-[12px] leading-relaxed text-muted-foreground',
        className,
      )}
    >
      This is a modelling tool, not financial advice. We show you maths on your
      own numbers — we don’t tell you what to do.
    </p>
  )
}
