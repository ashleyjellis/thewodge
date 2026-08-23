/**
 * A deliberately small markdown subset, parsed to a tree of values.
 *
 * ## Why not a markdown library
 *
 * Notes are short prose written by one operator through the admin panel. The
 * features that actually get used are paragraphs, two heading levels, a
 * bulleted list, bold, italic, inline code and links — everything else in a
 * full markdown implementation is surface this project does not need.
 *
 * The safety argument matters more than the dependency one. Every general
 * markdown renderer produces an HTML string, which then has to reach the page
 * through `dangerouslySetInnerHTML`, which means the note body is one
 * sanitiser bug away from executing script. This parser returns plain values
 * that a component renders as React elements, so note text is escaped by
 * React like any other string and there is no path from a note body to
 * markup at all. The only attribute that ever takes note-supplied content is
 * a link's href, and safeHref below is the single gate on it.
 *
 * ## What it does not do
 *
 * No nested emphasis (`**bold [link](x)**` renders the markers literally), no
 * ordered lists, no images, no tables, no block quotes, no raw HTML — raw HTML
 * is text, and renders as the characters typed. Each of those is a deliberate
 * omission rather than a gap: adding one means adding a test for how it fails,
 * and none has been needed yet.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

export type Block =
  | { kind: 'heading'; level: 2 | 3; content: Inline[] }
  | { kind: 'paragraph'; content: Inline[] }
  | { kind: 'list'; items: Inline[][] }

/**
 * The only place note content reaches an HTML attribute.
 *
 * Allows absolute http(s), mailto, and site-relative paths. Everything else —
 * `javascript:`, `data:`, `vbscript:`, a scheme nobody has thought of yet —
 * returns null and the link renders as plain text instead of disappearing, so
 * a mistyped URL is visible to whoever wrote it rather than silently dropped.
 *
 * Protocol-relative `//evil.example` is refused too: it reads like a path but
 * is an absolute URL to another host.
 */
export function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (href === '') return null
  if (href.startsWith('//')) return null
  if (href.startsWith('/') || href.startsWith('#')) return href
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href
  return null
}

// Order matters: ** before * so bold is not read as two italics.
const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g

function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0

  for (const match of text.matchAll(INLINE)) {
    const index = match.index
    if (index > last) out.push({ kind: 'text', text: text.slice(last, index) })

    const [full, linkText, linkHref, strong, em, code] = match
    if (linkText !== undefined && linkHref !== undefined) {
      const href = safeHref(linkHref)
      // A refused href becomes the link's own text rather than vanishing —
      // silently dropping it would hide the mistake from the author.
      out.push(href ? { kind: 'link', text: linkText, href } : { kind: 'text', text: linkText })
    } else if (strong !== undefined) out.push({ kind: 'strong', text: strong })
    else if (em !== undefined) out.push({ kind: 'em', text: em })
    else if (code !== undefined) out.push({ kind: 'code', text: code })

    last = index + full.length
  }

  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

export function parseNoteMarkdown(markdown: string): Block[] {
  const blocks: Block[] = []
  // Blank-line separated, with \r\n normalised — note bodies arrive from a
  // textarea and a Windows browser sends CRLF.
  const chunks = markdown.replace(/\r\n/g, '\n').split(/\n{2,}/)

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (trimmed === '') continue

    const lines = trimmed.split('\n')

    if (lines.every((line) => /^\s*-\s+/.test(line))) {
      blocks.push({
        kind: 'list',
        items: lines.map((line) => parseInline(line.replace(/^\s*-\s+/, ''))),
      })
      continue
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(trimmed)
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length === 2 ? 2 : 3,
        content: parseInline(heading[2]!),
      })
      continue
    }

    // A hard-wrapped paragraph joins into one, the way markdown does — a note
    // written in a narrow textarea should not render with ragged line breaks.
    blocks.push({ kind: 'paragraph', content: parseInline(lines.join(' ')) })
  }

  return blocks
}

/** Plain text of a note, for meta descriptions and list previews. */
export function noteExcerpt(markdown: string, maxLength = 180): string {
  const blocks = parseNoteMarkdown(markdown)
  const firstParagraph = blocks.find((block) => block.kind === 'paragraph')
  if (!firstParagraph || firstParagraph.kind !== 'paragraph') return ''

  const text = firstParagraph.content.map((inline) => inline.text).join('')
  if (text.length <= maxLength) return text
  // Cut at a word boundary so the excerpt does not end mid-word.
  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
