/**
 * Doorway guides — SEO content that opens the calculator with relevant numbers
 * pre-filled via search params. Data only; the template lives at /guides/$slug.
 *
 * Guides never compare the reader to anyone. "Am I behind?" is reframed to "here is
 * your own trajectory" (principles 1 and 3).
 *
 * datePublished/dateModified back the "last updated" line and the Article JSON-LD
 * on the guide template — real dates, not placeholders, so both stay honest.
 */
import type { CalculatorSearch } from './search'

export type GuideBlock = {
  heading?: string
  body: string[]
  /** an optional bullet list rendered after body — for scannable "what counts"
   *  style breakdowns, since a wall of prose is worse UX than a list here */
  list?: string[]
}

export type GuideFaqItem = { question: string; answer: string }

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
  /** rendered as its own section + FAQPage structured data when present */
  faq?: GuideFaqItem[]
  /** ISO date (YYYY-MM-DD) — when this guide first went live */
  datePublished: string
  /** ISO date — defaults to datePublished when the content hasn't changed since */
  dateModified?: string
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
    datePublished: '2026-07-18',
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
    datePublished: '2026-07-18',
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
  {
    slug: 'what-is-my-net-worth',
    question: 'What is my net worth?',
    title: 'What your net worth actually is — and how to work it out',
    metaTitle: 'What is net worth? How to calculate yours in minutes',
    description:
      'Net worth isn’t a report card — it’s one honest number: what you own minus what you owe. Here’s exactly how to work out yours, and where it’s heading.',
    datePublished: '2026-07-23',
    intro: [
      'Net worth sounds like a verdict. It isn’t — it’s just arithmetic: everything you own, minus everything you owe. One number, at one moment in time.',
      'It isn’t your salary and it isn’t a score. Below is exactly how to work yours out, what actually counts, and what to do with the number once you have it.',
    ],
    blocks: [
      {
        heading: 'The formula',
        body: [
          'Net worth = assets − liabilities. That’s the whole calculation.',
          'An asset is anything of value you own. A liability is anything you owe. Subtract one from the other and you have a single, honest snapshot of where you stand today.',
        ],
      },
      {
        heading: 'What counts as an asset',
        body: ['Add up the current value of everything you hold:'],
        list: [
          'Cash and savings — current accounts, savings accounts, cash ISAs, premium bonds',
          'Investments — stocks and shares ISAs, general investment accounts, shares held directly',
          'Pensions — the current transfer or fund value of workplace and personal pensions',
          'Property equity — your home’s market value minus whatever’s left on the mortgage, not the property’s full value',
          'Anything else genuinely sellable — a second property, a share in a business, or other significant assets',
        ],
      },
      {
        heading: 'What counts as a liability',
        body: ['Then add up what you owe:'],
        list: [
          'Your outstanding mortgage balance',
          'Personal loans and car finance',
          'Credit card balances you’re carrying, not just this month’s spend',
          'Student loan balances — Plan 1, 2, 4 or 5, even though they behave more like a graduate tax than a conventional loan',
          'Anything else you owe — to family, a former partner, or on a payment plan',
        ],
      },
      {
        heading: 'A worked example',
        body: [
          'Say you hold £8,000 in cash, £15,000 in a stocks and shares ISA, and £60,000 in your pension. Your flat is worth £280,000 and you owe £190,000 on the mortgage — so your equity in it is £90,000.',
          'Assets: £8,000 + £15,000 + £60,000 + £90,000 = £173,000.',
          'Now subtract what you owe: a £4,000 car loan and a £2,000 credit card balance still carried over — £6,000 in liabilities.',
          '£173,000 − £6,000 = £167,000 net worth. That’s the whole exercise — a handful of numbers in, one number out.',
        ],
      },
      {
        heading: 'The mistakes that throw the number off',
        body: [],
        list: [
          'Using your property’s full value instead of your equity in it — the mortgage is a liability, not something to ignore',
          'Leaving out your pension because it doesn’t feel like money you can touch yet — it’s still yours, and usually one of the largest numbers on the list',
          'Only counting cash — for most people it’s the smallest part of the picture, not the whole thing',
          'Missing debts that don’t come with a monthly reminder, like an old student loan or money owed to family',
        ],
      },
      {
        heading: 'Why it matters more than your salary',
        body: [
          'Income tells you what’s coming in. Net worth tells you what you’ve actually kept — the gap between the two is everything you’ve saved, invested, or paid off.',
          'It’s also the only number that captures your whole financial life at once: what’s in the bank, what’s growing in a pension, and what’s tied up in property, all together.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is net worth the same as my savings?',
        answer:
          'No — savings are just one line in the calculation. Net worth adds your pension, investments and property equity too, and subtracts what you owe. For most people it ends up a much bigger, and more complete, number than savings alone.',
      },
      {
        question: 'Should I include my pension?',
        answer:
          'Yes. It’s your money, even though you can’t access most of it until later in life. Leaving it out understates your position significantly — for many people it’s the single largest asset they hold.',
      },
      {
        question: 'Does my car count?',
        answer:
          'Only if you’re being precise about it, and most people don’t bother. A car loses value quickly and, unlike a house or a pension, isn’t really doing anything for your long-term position. It’s fine to leave everyday possessions out altogether.',
      },
      {
        question: 'What’s a good net worth for my age?',
        answer:
          'There isn’t one — that’s a comparison, not a calculation. Your number depends on your income, your choices, your city, and plenty you can’t control. What’s actually useful is knowing your own number today and watching where it’s heading, which is exactly what the calculator below does.',
      },
      {
        question: 'How often should I recalculate it?',
        answer:
          'Once or twice a year is plenty for most people. Net worth moves slowly, and checking daily mostly adds noise — especially for the part held in investments, which will rise and fall with the market regardless of anything you do.',
      },
    ],
    prefill: { age: 34, pension: 60_000, stocks: 15_000, cash: 8_000, monthly: 250 },
    ctaLabel: 'See where your net worth is heading',
  },
]

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug)
}
