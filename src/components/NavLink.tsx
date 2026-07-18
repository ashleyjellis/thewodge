/**
 * Internal navigation by string path. TanStack Router's Link `to` is typed to the
 * generated route union, which is exactly right for hand-written literals but fights
 * dynamic paths (STEPS, computed back targets). This wrapper centralises the single
 * cast so screens can navigate by string without scattering it.
 */
import { Link } from '@tanstack/react-router'
import type { MouseEventHandler, ReactNode } from 'react'

export function NavLink({
  to,
  className,
  children,
  onClick,
  ariaLabel,
}: {
  to: string
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
  ariaLabel?: string
}) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Link
      to={to as any}
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  )
}
