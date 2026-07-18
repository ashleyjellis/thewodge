/**
 * SiteFooter — link columns, a "not financial advice" line, and a capture-only
 * newsletter field. Calm and quiet; sentence case throughout.
 */
import { useState } from 'react'
import { SITE_NAME } from '@/config'
import { NavLink } from '@/components/NavLink'
import { MaxWidthContainer } from './Container'

const COLUMNS: { title: string; links: { to: string; label: string; hash?: string }[] }[] = [
  {
    title: 'The tool',
    links: [
      { to: '/', hash: 'calculator', label: 'Check your trajectory' },
      { to: '/how-it-works', label: 'How it works' },
      { to: '/methodology', label: 'The maths' },
    ],
  },
  {
    title: 'Guides',
    links: [
      { to: '/guides', label: 'All guides' },
      { to: '/guides/am-i-behind-for-my-age', label: 'See your own trajectory' },
      { to: '/guides/what-is-200-a-month-worth', label: 'What £200 a month is worth' },
    ],
  },
  {
    title: 'About',
    links: [
      { to: '/about', label: `Why ${SITE_NAME} exists` },
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 bg-background">
      <MaxWidthContainer className="py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="text-[15px] font-semibold tracking-tight">
              {SITE_NAME}
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              A calm way to see your whole financial picture — pension, investments
              and cash — carried forward. Consequences, not verdicts.
            </p>
            <NewsletterForm />
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <NavLink
                      to={link.to}
                      hash={link.hash}
                      className="text-[14px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border/70 pt-6">
          <p className="max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
            {SITE_NAME} is a modelling tool, not financial advice. It shows the
            consequences of your own numbers under stated assumptions — it doesn’t
            tell you what to do, and it makes no comparison to anyone else.
          </p>
          <p className="mt-3 text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} {SITE_NAME}
          </p>
        </div>
      </MaxWidthContainer>
    </footer>
  )
}

function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setState('error')
      return
    }
    setState('done')
    // capture-only, non-blocking — never gates the reader on a backend.
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }).catch(() => undefined)
  }

  return (
    <form onSubmit={submit} className="mt-6 max-w-xs">
      <label
        htmlFor="newsletter-email"
        className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        The occasional note
      </label>
      {state === 'done' ? (
        <p className="mt-3 text-[13px] text-foreground">
          Thanks — we’ll be in touch, rarely.
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            id="newsletter-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (state === 'error') setState('idle')
            }}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-full bg-card px-4 py-2.5 text-[14px] text-foreground outline-none ring-1 ring-border focus:ring-foreground/30"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-foreground px-4 py-2.5 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
          >
            Subscribe
          </button>
        </div>
      )}
      {state === 'error' ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          That doesn’t look like an email.
        </p>
      ) : null}
    </form>
  )
}
