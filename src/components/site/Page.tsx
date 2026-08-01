/**
 * Content-page building blocks — a calm page header and a long-form prose block.
 * Sentence case, generous whitespace, quiet.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { MaxWidthContainer } from './Container'

export function PageHeader({
  eyebrow,
  title,
  intro,
  className,
}: {
  eyebrow?: string
  title: string
  intro?: ReactNode
  className?: string
}) {
  return (
    <MaxWidthContainer className={cn('pt-16 lg:pt-20', className)}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-tight">
          {title}
        </h1>
        {intro ? (
          <div className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
            {intro}
          </div>
        ) : null}
      </div>
    </MaxWidthContainer>
  )
}

/** Long-form prose with calm rhythm — used on methodology, about, legal. */
export function Prose({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'max-w-2xl space-y-5 text-[14px] leading-relaxed text-foreground/85',
        '[&_h2]:mt-12 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground',
        '[&_h3]:mt-8 [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-foreground',
        '[&_a]:text-[18px] [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2',
        '[&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:list-disc [&_li]:marker:text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
