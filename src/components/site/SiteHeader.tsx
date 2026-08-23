/**
 * SiteHeader — logo left, nav, primary CTA right. Sticky on scroll. Collapses to a
 * menu at mobile widths. Sentence case, calm, quiet.
 *
 * The nav is the fixed marketing links plus whichever product surfaces are
 * currently visible (src/surfaces.json, via navigableSurfaces()). A surface
 * that is switched off simply stops appearing here — its URLs still resolve,
 * so a link can be shared, but nothing in the site points at it. A visible
 * surface with no destinations yet renders nothing rather than an empty menu.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'
import { SITE_NAME, navigableSurfaces } from '@/config'
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

const linkClass =
  'text-[14px] text-muted-foreground transition-colors hover:text-foreground'

/**
 * A nav item that opens a submenu. Closes on Escape and on a click anywhere
 * outside it — both expected of a menu, and neither free, since this is the
 * first nested menu on the site.
 */
function NavDropdown({
  label,
  items,
}: {
  label: string
  items: { to: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={cn(linkClass, 'inline-flex items-center gap-1')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown
          size={14}
          strokeWidth={2.25}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 min-w-48 rounded-2xl border border-border/70 bg-background p-1.5 shadow-lg"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeClassName="text-foreground"
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const surfaces = navigableSurfaces()

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
                className={linkClass}
                activeClassName="text-foreground"
              >
                {item.label}
              </NavLink>
            ))}
            {surfaces.map((surface) => (
              <NavDropdown key={surface.id} label={surface.label} items={surface.nav} />
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

              {/* Surfaces expand inline on mobile rather than nesting a second
                  layer of menu inside an already-open one. */}
              {surfaces.map((surface) => (
                <div key={surface.id} className="mt-2">
                  <p className="px-3 pb-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    {surface.label}
                  </p>
                  {surface.nav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-3 text-[14px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
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
