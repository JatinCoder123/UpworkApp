import { asText } from '../lib/safe'

// **bold** inside a line; everything else stays plain text (no HTML is ever injected).
function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (/^\*\*[^*]+\*\*$/.test(part)
    ? <strong key={index} className="font-semibold text-[var(--ink)]">{part.slice(2, -2)}</strong>
    : part))
}

const BULLET = /^\s*[-*•]\s+/
const NUMBERED = /^\s*\d+[.)]\s+/

/**
 * Renders the simple Markdown the AI endpoints return: paragraphs, bullet and numbered lists,
 * `#` headings and **bold**. Line breaks inside a paragraph are kept.
 */
export default function AiAnswer({ text, className = '' }) {
  const blocks = asText(text).replace(/\r\n/g, '\n').split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  return <div className={`space-y-3 text-sm leading-7 ${className}`}>
    {blocks.map((block, index) => {
      const lines = block.split('\n')
      if (lines.every((line) => BULLET.test(line))) {
        return <ul key={index} className="list-disc space-y-1 pl-5">{lines.map((line, i) => <li key={i}><Inline text={line.replace(BULLET, '')} /></li>)}</ul>
      }
      if (lines.every((line) => NUMBERED.test(line))) {
        return <ol key={index} className="list-decimal space-y-1 pl-5">{lines.map((line, i) => <li key={i}><Inline text={line.replace(NUMBERED, '')} /></li>)}</ol>
      }
      if (lines.length === 1 && /^#{1,6}\s+/.test(block)) {
        return <p key={index} className="font-semibold text-[var(--ink)]"><Inline text={block.replace(/^#{1,6}\s+/, '')} /></p>
      }
      return <p key={index} className="whitespace-pre-wrap break-words"><Inline text={block} /></p>
    })}
  </div>
}
