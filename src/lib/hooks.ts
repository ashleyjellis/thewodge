/**
 * Product hooks — the locked-assumption rows, the partner CTA, and the save-
 * forecast closer all open the same modal shape with different content, and all
 * route to the same placeholder account-creation entry point (/app), carrying
 * what triggered them via a query param. Brand voice throughout: calm, factual,
 * no urgency, "here's what this doesn't do yet" — never a nag or a paywall threat.
 */

export type HookId =
  | 'cash-rate'
  | 'invested-rate'
  | 'employer-split'
  | 'partner'
  | 'save-forecast'
  | 'save-plan'

export type HookContent = {
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
}

export const HOOKS: Record<HookId, HookContent> = {
  'cash-rate': {
    eyebrow: 'an assumed rate',
    title: 'We’ve assumed cash grows at 4.5% a year',
    body: 'That rate is set once, for everyone, based on a typical easy-access or cash ISA rate — not your actual account. A free account would let you enter the real rate you’re getting instead of this stand-in.',
    ctaLabel: 'Create a free account to enter your own',
  },
  'invested-rate': {
    eyebrow: 'an assumed rate',
    title: 'We’ve assumed investments grow at 7% a year',
    body: 'That’s one long-run average applied to everyone, not a forecast of your actual holdings. A free account would let you set your own assumption, or reflect a specific portfolio.',
    ctaLabel: 'Create a free account to enter your own',
  },
  'employer-split': {
    eyebrow: 'an assumed contribution',
    title: 'We’ve assumed 6% employer + 6% you',
    body: 'You gave us an income but not a pension contribution, so we estimated one using a common employer-match shape. It’s a stand-in, not your actual rate. A free account would let you enter your real contribution instead of this estimate.',
    ctaLabel: 'Create a free account to enter your own',
  },
  partner: {
    eyebrow: 'a missing capability, not a setting',
    title: 'This tool currently plans for one person',
    body: 'Most of our readers plan as a household — two pensions, two sets of investments, one shared picture. Adding a partner changes almost everything about how this looks. A free account is where that becomes possible.',
    ctaLabel: 'Create a free account to add your partner',
  },
  'save-forecast': {
    eyebrow: 'keep this',
    title: 'Save this forecast',
    body: 'A free account keeps this forecast and lets you come back to see how it’s tracking — the same calm view, over time, measured only against where you started.',
    ctaLabel: 'Create a free account to save this',
  },
  'save-plan': {
    eyebrow: 'keep this',
    title: 'Save this plan',
    body: 'A free account keeps your pension, ISAs and cash together and lets you come back to see how they’re actually moving — updated as reality changes, not modelled once and left behind.',
    ctaLabel: 'Create a free account to save this',
  },
}
