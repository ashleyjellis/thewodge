/**
 * Primary button (brand guide §6): full-width, rounded-full, navy fill, warm-white
 * text, py-4, semibold. Hover = opacity-95. Decisions are singular — there is no
 * secondary button beside it.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const primaryButtonClass =
  'block w-full rounded-full bg-foreground px-6 py-4 text-center text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40'

export function PrimaryButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button className={cn(primaryButtonClass, className)} {...props}>
      {children}
    </button>
  )
}

/**
 * Sticky CTA holder: full-bleed, sits on a to-top gradient from the background so
 * scrolled content fades under it. Give the page's main a pb-40 so nothing hides.
 */
export function StickyCta({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background from-55% to-transparent pb-6 pt-10">
      <div className="mx-auto max-w-[420px] px-5">{children}</div>
    </div>
  )
}
