/**
 * The admin area's layout, and its front door.
 *
 * Auth is checked here rather than per-route, so a new admin screen is
 * protected by existing rather than by remembering to add a guard. Session
 * state lives in one place and the login form renders in place of the outlet
 * — no redirect, so signing in returns you to whatever you were trying to
 * reach.
 *
 * The server checks the session again on every API call. This is the door;
 * the API is the lock.
 */
import { useCallback, useEffect, useState } from 'react'
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { NavLink } from '@/components/NavLink'
import { MaxWidthContainer } from '@/components/site/Container'

const adminSeo = seo({
  title: `Admin — ${SITE_NAME}`,
  description: 'Internal.',
  path: '/performance/admin',
})

export const Route = createFileRoute('/performance/admin')({
  head: () => ({
    links: adminSeo.links,
    meta: [...adminSeo.meta, { name: 'robots', content: 'noindex' }],
  }),
  component: AdminLayout,
})

const TABS = [
  { to: '/performance/admin/entry', label: 'Weekly entry' },
]

function AdminLayout() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/tracker/session')
      const data = await response.json()
      setSignedIn(Boolean(data?.signedIn))
    } catch {
      setSignedIn(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/tracker/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? 'could not sign in')
        return
      }
      setPassword('')
      await refresh()
    } catch {
      setError('could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await fetch('/api/tracker/session', { method: 'DELETE' })
    await refresh()
  }

  if (signedIn === null) {
    return (
      <MaxWidthContainer className="py-16">
        <p className="text-[14px] text-muted-foreground">Checking…</p>
      </MaxWidthContainer>
    )
  }

  if (!signedIn) {
    return (
      <MaxWidthContainer className="py-16">
        <div className="mx-auto max-w-sm rounded-2xl bg-card p-6 shadow-sm">
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Internal. One operator.
          </p>
          <form onSubmit={signIn} className="mt-5 space-y-3">
            <label className="block">
              <span className="text-[13px] text-muted-foreground">Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-[14px]"
              />
            </label>
            <label className="block">
              <span className="text-[13px] text-muted-foreground">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-[14px]"
              />
            </label>
            {error ? <p className="text-[13px] text-foreground">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-foreground px-5 py-2.5 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </MaxWidthContainer>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-background">
        <MaxWidthContainer>
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <span className="text-[14px] font-semibold tracking-tight text-foreground">
                {SITE_NAME} admin
              </span>
              <nav className="flex items-center gap-5">
                {TABS.map((tab) => (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className="text-[14px] text-muted-foreground transition-colors hover:text-foreground"
                    activeClassName="text-foreground"
                  >
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </MaxWidthContainer>
      </header>
      <MaxWidthContainer className="py-8">
        <Outlet />
      </MaxWidthContainer>
    </div>
  )
}
