/**
 * The note markdown subset.
 *
 * The assertions that earn their place are the ones about what the parser
 * refuses: an href it will not emit, and markup it treats as text. Everything
 * this parser produces is rendered by React as elements, so the only way a
 * note body can reach the browser as anything but text is through a link's
 * href — which makes safeHref the one function here with a security job.
 */
import { describe, expect, it } from 'vitest'
import { noteExcerpt, parseNoteMarkdown, safeHref } from './markdown'

describe('safeHref', () => {
  it('allows the schemes a note legitimately links with', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a')
    expect(safeHref('http://example.com')).toBe('http://example.com')
    expect(safeHref('mailto:hello@example.com')).toBe('mailto:hello@example.com')
    expect(safeHref('/performance/method')).toBe('/performance/method')
    expect(safeHref('#the-ledger')).toBe('#the-ledger')
  })

  it('refuses script-bearing schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('JavaScript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeHref('vbscript:msgbox')).toBeNull()
  })

  it('refuses a protocol-relative URL, which reads like a path but is not', () => {
    expect(safeHref('//evil.example/x')).toBeNull()
  })

  it('refuses an empty or whitespace href', () => {
    expect(safeHref('')).toBeNull()
    expect(safeHref('   ')).toBeNull()
  })
})

describe('parseNoteMarkdown', () => {
  it('splits paragraphs on blank lines', () => {
    const blocks = parseNoteMarkdown('First para.\n\nSecond para.')
    expect(blocks).toHaveLength(2)
    expect(blocks.every((b) => b.kind === 'paragraph')).toBe(true)
  })

  it('joins a hard-wrapped paragraph into one', () => {
    const blocks = parseNoteMarkdown('written in\na narrow\ntextarea')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      content: [{ kind: 'text', text: 'written in a narrow textarea' }],
    })
  })

  it('reads two heading levels', () => {
    const blocks = parseNoteMarkdown('## Two\n\n### Three')
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 2 })
    expect(blocks[1]).toMatchObject({ kind: 'heading', level: 3 })
  })

  it('reads a bulleted list as one block', () => {
    const blocks = parseNoteMarkdown('- one\n- two\n- three')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'list' })
    expect((blocks[0] as { items: unknown[] }).items).toHaveLength(3)
  })

  it('reads bold, italic and inline code', () => {
    const [block] = parseNoteMarkdown('a **b** c *d* e `f`')
    expect((block as { content: unknown[] }).content).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'strong', text: 'b' },
      { kind: 'text', text: ' c ' },
      { kind: 'em', text: 'd' },
      { kind: 'text', text: ' e ' },
      { kind: 'code', text: 'f' },
    ])
  })

  it('does not read bold as two italics', () => {
    const [block] = parseNoteMarkdown('**bold**')
    expect((block as { content: unknown[] }).content).toEqual([{ kind: 'strong', text: 'bold' }])
  })

  it('leaves an unclosed marker as literal text', () => {
    const [block] = parseNoteMarkdown('2 * 3 = 6')
    expect((block as { content: unknown[] }).content).toEqual([{ kind: 'text', text: '2 * 3 = 6' }])
  })

  it('reads a link with a safe href', () => {
    const [block] = parseNoteMarkdown('see [the method](/performance/method) for more')
    expect((block as { content: unknown[] }).content).toContainEqual({
      kind: 'link',
      text: 'the method',
      href: '/performance/method',
    })
  })

  it('degrades an unsafe link to its own text rather than dropping it', () => {
    // Visible to the author as a broken link, rather than silently vanishing
    // — and never emitted as an href.
    const [block] = parseNoteMarkdown('[click me](javascript:alert(1))')
    const content = (block as { content: Array<{ kind: string }> }).content
    expect(content.some((part) => part.kind === 'link')).toBe(false)
    expect(content).toContainEqual({ kind: 'text', text: 'click me' })
  })

  it('treats raw HTML as text, so a note body cannot inject markup', () => {
    const [block] = parseNoteMarkdown('<script>alert(1)</script>')
    expect(block).toEqual({
      kind: 'paragraph',
      content: [{ kind: 'text', text: '<script>alert(1)</script>' }],
    })
  })

  it('normalises CRLF from a Windows browser', () => {
    expect(parseNoteMarkdown('one\r\n\r\ntwo')).toHaveLength(2)
  })

  it('produces nothing from empty or whitespace-only input', () => {
    expect(parseNoteMarkdown('')).toEqual([])
    expect(parseNoteMarkdown('   \n\n  ')).toEqual([])
  })
})

describe('noteExcerpt', () => {
  it('takes the first paragraph, without its markup', () => {
    expect(noteExcerpt('## Heading\n\nThe **first** paragraph.')).toBe('The first paragraph.')
  })

  it('truncates on a word boundary', () => {
    const excerpt = noteExcerpt('word '.repeat(60), 40)
    expect(excerpt.length).toBeLessThanOrEqual(41)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt).not.toMatch(/wor…$/)
  })

  it('returns nothing for a note with no paragraph', () => {
    expect(noteExcerpt('## Only a heading')).toBe('')
  })
})
