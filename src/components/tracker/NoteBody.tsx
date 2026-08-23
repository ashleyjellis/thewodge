/**
 * Renders a parsed note as React elements.
 *
 * Every string here goes through JSX as a child, so React escapes it. There
 * is no dangerouslySetInnerHTML in this file and there should never be one —
 * that is the entire security model for note bodies, and it holds only as
 * long as this component stays the single way a note reaches the page. See
 * src/lib/tracker/markdown.ts.
 */
import { Fragment } from 'react'
import { parseNoteMarkdown, type Inline } from '@/lib/tracker/markdown'
import { cn } from '@/lib/cn'

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, index) => {
        switch (part.kind) {
          case 'strong':
            return (
              <strong key={index} className="font-semibold text-foreground">
                {part.text}
              </strong>
            )
          case 'em':
            return <em key={index}>{part.text}</em>
          case 'code':
            return (
              <code key={index} className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">
                {part.text}
              </code>
            )
          case 'link': {
            // Anything not on this origin opens away from the site and gets
            // rel=noreferrer; a relative link is internal and keeps neither.
            const external = /^https?:\/\//i.test(part.href)
            return (
              <a
                key={index}
                href={part.href}
                className="text-foreground underline underline-offset-2"
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
              >
                {part.text}
              </a>
            )
          }
          default:
            return <Fragment key={index}>{part.text}</Fragment>
        }
      })}
    </>
  )
}

export function NoteBody({ markdown, className }: { markdown: string; className?: string }) {
  const blocks = parseNoteMarkdown(markdown)

  return (
    <div className={cn('max-w-2xl space-y-5 text-[15px] leading-relaxed text-foreground/85', className)}>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return block.level === 2 ? (
            <h2
              key={index}
              className="!mt-10 text-[20px] font-semibold tracking-tight text-foreground"
            >
              <Inlines parts={block.content} />
            </h2>
          ) : (
            <h3 key={index} className="!mt-8 text-[15px] font-semibold text-foreground">
              <Inlines parts={block.content} />
            </h3>
          )
        }

        if (block.kind === 'list') {
          return (
            <ul key={index} className="space-y-2 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="list-disc marker:text-muted-foreground">
                  <Inlines parts={item} />
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={index}>
            <Inlines parts={block.content} />
          </p>
        )
      })}
    </div>
  )
}
