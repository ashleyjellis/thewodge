/**
 * Doorway guides — SEO content that opens the calculator with relevant numbers
 * pre-filled via search params. Data only; the template lives at /guides/$slug.
 *
 * Guides never compare the reader to anyone. "Am I behind?" is reframed to "here is
 * your own trajectory" (principles 1 and 3).
 */
import type { CalculatorSearch } from './search'

export type GuideBlock = { heading?: string; body: string[] }

export type Guide = {
  slug: string
  /** page H1 */
  title: string
  /** <title> */
  metaTitle: string
  /** meta description */
  description: string
  /** the question in the reader's own words (eyebrow) */
  question: string
  intro: string[]
  blocks: GuideBlock[]
  /** values the CTA pre-fills into the calculator */
  prefill: CalculatorSearch
  ctaLabel: string
}

export const GUIDES: Guide[] = [
  {
    slug: 'am-i-behind-for-my-age',
    question: 'Am I behind for my age?',
    title: 'You’re not behind — here’s your actual trajectory',
    metaTitle: 'Am I behind for my age? See your own trajectory instead',
    description:
      'There’s no line you’re behind. Skip the averages and see where your own pension, investments and cash are actually heading by 60.',
    intro: [
      '“Behind” only makes sense against someone else’s number — an average, a cohort, a rule of thumb. None of those are you, and none of them know what you hold, what you earn, or what you want.',
      'So we don’t answer “am I behind?”. We answer a better question: given your money, where are you actually heading?',
    ],
    blocks: [
      {
        heading: 'Why we don’t compare you to anyone',
        body: [
          'Averages hide enormous variation and quietly set a finish line you never chose. Comparing to them tends to produce anxiety, not action.',
          'The useful thing isn’t a verdict — it’s a trajectory you can see and change. That’s all this tool does.',
        ],
      },
      {
        heading: 'What to look at instead',
        body: [
          'Your whole picture in one place: pension, stocks and shares, and cash, carried forward to 60.',
          'The split between what you put in and what the market adds — usually the market does most of the work, given enough time.',
          'What changes if you change: stopping, carrying on, or adding a little more each month.',
        ],
      },
    ],
    prefill: { age: 38, pension: 60_000, stocks: 25_000, cash: 15_000, monthly: 300 },
    ctaLabel: 'See your own trajectory',
  },
  {
    slug: 'what-is-200-a-month-worth',
    question: 'What is £200 a month actually worth?',
    title: 'What £200 a month is worth by 60',
    metaTitle: 'What is £200 a month worth by 60?',
    description:
      'Small, steady contributions compound. See what £200 a month adds to your pot by 60 — and what the market adds on top of it.',
    intro: [
      '£200 a month feels small. Over years, compounding does something that doesn’t feel small at all.',
      'Rather than quote a single headline number, fill in your own starting pots and watch the contribution and the growth stack up.',
    ],
    blocks: [
      {
        heading: 'The part you put in',
        body: [
          '£200 a month is £2,400 a year. Over 25 years that’s £60,000 of your own money — steady, unremarkable, entirely within your control.',
        ],
      },
      {
        heading: 'The part the market adds',
        body: [
          'Invested and left alone, those contributions grow — and the growth compounds on earlier growth. By 60 the market’s share often dwarfs the contributions themselves.',
          'The scenario table shows exactly this: carry on, or add £100 or £500 a month, and see each result side by side.',
        ],
      },
    ],
    prefill: { age: 35, pension: 40_000, stocks: 10_000, cash: 10_000, monthly: 200 },
    ctaLabel: 'See what your contributions become',
  },
]

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug)
}
