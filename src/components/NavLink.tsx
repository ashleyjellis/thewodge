/**
 * Internal navigation by string path. TanStack Router's Link `to` is typed to the
 * generated route union, which is right for hand-written literals but fights dynamic
 * paths and cross-route deep-links carrying search params. This wrapper centralises
 * the single cast so pages can navigate (and pre-fill the calculator) by value.
 */
import { Link } from '@tanstack/react-router'
import type { MouseEventHandler, ReactNode } from 'react'

export function NavLink({
  to,
  className,
  children,
  onClick,
  ariaLabel,
  hash,
  search,
  activeClassName,
}: {
  to: string
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
  ariaLabel?: string
  hash?: string
  search?: Record<string, unknown>
  activeClassName?: string
}) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Link
      to={to as any}
      hash={hash as any}
      search={search as any}
      className={className}
      activeProps={activeClassName ? { className: activeClassName } : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  )
}
