/**
 * One dated feed per portfolio.
 *
 * Mixes what the provider did — rebalances, changes to the rate card — with
 * what we noticed, which is a holdings shift big enough to be a decision
 * rather than drift. The two are labelled differently and deliberately: a
 * rebalance someone read in a provider's own note is a fact about the firm,
 * while a holdings shift is our reading of two monthly snapshots, and
 * presenting the second as though the firm announced it would be putting
 * words in their mouth.
 *
 * This is the section that makes the page worth returning to, so it is also
 * the one that must not fill itself with noise. Generated entries only appear
 * above a threshold — see isChangelogWorthy in lib/tracker/holdings.
 */
import { NoteBody } from '@/components/tracker/NoteBody'
import { cn } from '@/lib/cn'
import type { EventKind } from '@/server/trackerDb/schema'

export type ChangelogEntry = {
  eventDate: string
  kind: EventKind
  title: string
  bodyMd: string | null
  sourceUrl: string | null
  isGenerated: boolean
}

const KIND_LABEL: Record<EventKind, string> = {
  rebalance: 'Rebalance',
  fees: 'Charges',
  holdings: 'Holdings',
  commentary: 'Note',
}

export function Changelog({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="text-[15px] font-medium text-foreground">Nothing to report yet.</p>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
          Rebalances, changes to the charges and material shifts in what the portfolio holds are
          recorded here as they happen. An empty feed means nothing has happened worth writing
          down — not that nothing is being watched.
        </p>
      </div>
    )
  }

  const ordered = [...entries].sort((a, b) => b.eventDate.localeCompare(a.eventDate))

  return (
    <ol className="mt-6 space-y-3">
      {ordered.map((entry, index) => (
        <li
          key={`${entry.eventDate}-${entry.title}-${index}`}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {entry.eventDate}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.08em]',
                'bg-muted text-muted-foreground',
              )}
            >
              {KIND_LABEL[entry.kind]}
            </span>
            {entry.isGenerated ? (
              // Said out loud. A reader is entitled to know which lines are
              // the provider's doing and which are our inference from two
              // snapshots a month apart.
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70">
                observed here, not announced
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-[16px] font-medium leading-snug text-foreground">{entry.title}</p>

          {entry.bodyMd ? <NoteBody markdown={entry.bodyMd} className="mt-3 text-[14px]" /> : null}

          {entry.sourceUrl ? (
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-[13px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Where this came from
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
