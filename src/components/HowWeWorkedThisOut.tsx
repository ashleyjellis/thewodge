/**
 * "How we worked this out" drawer (spec §6) — transparency as a trust-builder.
 * Every screen can drop this in: the formula in plain English AND the actual
 * numbers plugged in. Native <details> — dyslexia-friendly, works without JS.
 */
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export function HowWeWorkedThisOut({
  children,
  label = 'how we worked this out',
  className,
}: {
  children: ReactNode
  label?: string
  className?: string
}) {
  return (
    <details className={cn('group', className)}>
      <summary className="flex items-center justify-between gap-3 py-1 text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground">
        {label}
        <ChevronDown
          size={16}
          strokeWidth={2.25}
          className="drawer-chevron shrink-0"
        />
      </summary>
      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  )
}

/** A single formula line: plain-English name, then the numbers. */
export function Working({
  formula,
  numbers,
}: {
  formula: string
  numbers: string
}) {
  return (
    <div className="rounded-2xl bg-muted/60 px-4 py-3">
      <p className="text-foreground">{formula}</p>
      <p className="mt-1 tabular-nums">{numbers}</p>
    </div>
  )
}
