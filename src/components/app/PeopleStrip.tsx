/**
 * The Dashboard's people strip — a card per person in the household, plus an
 * "add a person" nudge when there's only one (a household can hold at most
 * two — see MAX_PEOPLE_PER_HOUSEHOLD).
 */
import { NavLink } from '@/components/NavLink'

export function PeopleStrip({ people }: { people: { id: string; name: string; age: number }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {people.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-soft">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-foreground">
            {p.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[14px] font-semibold leading-tight">{p.name}</p>
            <p className="text-[12px] text-muted-foreground">Age {p.age}</p>
          </div>
        </div>
      ))}
      {people.length === 1 ? (
        <NavLink
          to="/app/accounts"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-5 py-4 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-current text-[16px] leading-none">
            +
          </div>
          <div>
            <p className="text-[14px] font-semibold leading-tight">Add a person</p>
            <p className="text-[12px]">Plan for your household together</p>
          </div>
        </NavLink>
      ) : null}
    </div>
  )
}
