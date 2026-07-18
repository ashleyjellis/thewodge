/**
 * MaxWidthContainer — the site frame (~1180px). Desktop uses the horizontal space;
 * the narrow single column only appears at mobile widths. This is the main fix for
 * the "app on a page" feel.
 */
import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function MaxWidthContainer({
  children,
  className,
  as: As = 'div',
}: {
  children: ReactNode
  className?: string
  as?: ElementType
}) {
  return (
    <As className={cn('mx-auto w-full max-w-[1180px] px-5 sm:px-6 lg:px-8', className)}>
      {children}
    </As>
  )
}
