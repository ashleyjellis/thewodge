/**
 * The signed-in arc (spec §0, §4). Every screen maps to a step in the emotional
 * journey: where am I → am I doing well → what's the machine doing → what does the
 * future look like → what am I free to do. Order is the product.
 */
export type Step = {
  path: string
  eyebrow: string
  title: string
}

export const STEPS: Step[] = [
  {
    path: '/app/where-am-i',
    eyebrow: 'where you stand',
    title: 'Where am I, really?',
  },
  {
    path: '/app/on-track',
    eyebrow: 'am I doing well',
    title: 'Am I on track?',
  },
  {
    path: '/app/the-machine',
    eyebrow: 'what the machine does',
    title: 'What’s the machine doing?',
  },
  {
    path: '/app/the-future',
    eyebrow: 'what the future looks like',
    title: 'What does my future look like?',
  },
  {
    path: '/app/what-am-i-free',
    eyebrow: 'what you’re free to do',
    title: 'So what am I free to do?',
  },
]

export const TRACK_PATH = '/app/track'
