/**
 * SiteHeader — logo left, nav, primary CTA right. Sticky on scroll. Collapses to a
 * menu at mobile widths. Sentence case, calm, quiet.
 */
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { SITE_NAME } from '@/config'
import { cn } from '@/lib/cn'
import { NavLink } from '@/components/NavLink'
import { MaxWidthContainer } from './Container'

const NAV = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/guides', label: 'Guides' },
  { to: '/methodology', label: 'The maths' },
  { to: '/about', label: 'About' },
]

const ctaClass =
  'inline-flex items-center rounded-full bg-foreground px-4 py-2 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95'

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
      <MaxWidthContainer>
        <div className="flex h-16 items-center justify-between gap-4">
          <NavLink
            to="/"
            className="text-[15px] font-semibold tracking-tight text-foreground"
            ariaLabel={`${SITE_NAME} home`}
          >
            {SITE_NAME}
          </NavLink>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="text-[14px] text-muted-foreground transition-colors hover:text-foreground"
                activeClassName="text-foreground"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:block">
            <NavLink to="/" hash="calculator" className={ctaClass}>
              Check your trajectory
            </NavLink>
          </div>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X size={20} strokeWidth={2.25} />
            ) : (
              <Menu size={20} strokeWidth={2.25} />
            )}
          </button>
        </div>
      </MaxWidthContainer>

      {open ? (
        <div className="border-t border-border/70 bg-background md:hidden">
          <MaxWidthContainer className="py-4">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'rounded-xl px-3 py-3 text-[14px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to="/"
                hash="calculator"
                onClick={() => setOpen(false)}
                className={cn(ctaClass, 'mt-2 justify-center')}
              >
                Check your trajectory
              </NavLink>
            </nav>
          </MaxWidthContainer>
        </div>
      ) : null}
    </header>
  )
}
