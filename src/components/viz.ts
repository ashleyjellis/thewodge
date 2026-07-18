/**
 * Data-viz tones (LOCKED brand guide §9). Navy = "you" / contribution / pension.
 * Accent (light blue) = "market" / world / the bridge. Cash is a different job —
 * a neutral muted tone, never a new hue. Never swap navy and accent.
 *
 * SVG fills reference the theme CSS variables so there is still no hardcoded hex.
 */
export type Tone = 'you' | 'market' | 'cash' | 'muted'

/** dot swatch (h-2.5 w-2.5 rounded-full) */
export const dotClass: Record<Tone, string> = {
  you: 'bg-foreground',
  market: 'bg-accent',
  cash: 'bg-muted-foreground/40',
  muted: 'bg-muted-foreground/20',
}

/** solid fill for bar segments */
export const fillClass: Record<Tone, string> = {
  you: 'bg-foreground',
  market: 'bg-accent',
  cash: 'bg-muted-foreground/30',
  muted: 'bg-muted',
}

/** SVG fill via the theme variable (no hardcoded hex) */
export const svgFill: Record<Tone, string> = {
  you: 'var(--color-foreground)',
  market: 'var(--color-accent)',
  cash: 'var(--color-muted-foreground)',
  muted: 'var(--color-muted)',
}
