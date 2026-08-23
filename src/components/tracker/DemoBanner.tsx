/**
 * The persistent demo banner.
 *
 * Every public tracker page carries this while DEMO_MODE is on. Not
 * dismissible: a banner someone can close is a banner that is absent in the
 * screenshot they then share, and fabricated performance figures circulating
 * without their disclaimer is the specific outcome this exists to prevent.
 */
import { DEMO_MODE } from '@/config'

export function DemoBanner() {
  if (!DEMO_MODE) return null

  return (
    <div className="border-b border-border/70 bg-accent/40">
      <div className="mx-auto max-w-[1180px] px-5 py-2.5 text-[13px] text-foreground">
        <span className="font-semibold">Demo data.</span>{' '}
        Every provider and figure on this page is invented, for testing how the
        record works before any real money is invested. Nothing here describes a
        real firm.
      </div>
    </div>
  )
}
