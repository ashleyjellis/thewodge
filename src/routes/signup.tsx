import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { getStore } from '@/lib/store'
import { money } from '@/lib/format'
import { Card, Eyebrow, Muted, NotAdviceLine, Wordmark } from '@/components/brand'
import { PrimaryButton } from '@/components/PrimaryButton'
import { NavLink } from '@/components/NavLink'

export const Route = createFileRoute('/signup')({
  component: Signup,
})

function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('that doesn’t look like an email')
      return
    }
    setBusy(true)
    try {
      // email goes server-side (the list is the asset); financials never do.
      // non-blocking — a capture hiccup never stops someone seeing their picture.
      await fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }).catch(() => undefined)
      getStore().saveEmail(email.trim().toLowerCase())
      void navigate({ to: '/app/where-am-i' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-[420px] px-5 pb-16 pt-6">
        <header className="flex items-center justify-between">
          <NavLink
            to="/"
            ariaLabel="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </NavLink>
          <Wordmark className="text-muted-foreground" />
        </header>

        <div className="mt-12">
          <Eyebrow>your full picture</Eyebrow>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight">
            Where you’re heading, on your own numbers.
          </h1>
          <Muted className="mt-4">
            Net worth split three ways, your Coast FI, the year the market takes
            over, and the earliest you could stop. One email — no password, ever.
          </Muted>
        </div>

        <Card className="mt-8">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Email
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
              }}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-2xl bg-muted px-4 py-3 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-accent/40"
            />
          </label>
          {error ? (
            <p className="mt-2 text-[12px] text-muted-foreground">{error}</p>
          ) : null}
          <div className="mt-5">
            <PrimaryButton disabled={busy} onClick={() => void submit()}>
              {busy ? 'One moment…' : 'See my wealth picture →'}
            </PrimaryButton>
          </div>
          <Muted className="mt-3 text-[12px]">
            We store your email to send a monthly prompt. Your financial numbers
            stay on your device — they’re never sent to us. Modelled figures are in
            today’s money and can reach {money(1_000_000)}+ in these examples.
          </Muted>
        </Card>

        <div className="mt-8">
          <NotAdviceLine />
        </div>
      </div>
    </main>
  )
}
