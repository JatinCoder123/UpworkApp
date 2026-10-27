import { useMemo } from 'react'
import { AppWindow, CheckCircle, CircleNotch, XCircle } from '@phosphor-icons/react'
import { ACTION_INFO } from './playgroundUi'
import { asText } from '../../lib/safe'

/*
 * Pieces shared by the API Playground's form, result and history: a test type's icon, a test's status in plain
 * words, Claude's text and the coloured JSON view.
 */

/** A test type's icon. */
export function ActionIcon({ action, ...props }) {
  const Icon = ACTION_INFO[action]?.[4] || AppWindow
  return <Icon {...props} />
}

/** A test's state in plain words: Waiting, Working, Done or Failed. */
export function StatusChip({ status }) {
  const [text, cls, Icon] = status === 'completed' ? ['Done', 'bg-[var(--ok-bg)] text-[var(--ok)]', CheckCircle]
    : status === 'failed' ? ['Failed', 'bg-[var(--bad-bg)] text-[var(--bad)]', XCircle]
      : [status === 'queued' ? 'Waiting' : 'Working', 'bg-[var(--warn-bg)] text-[var(--warn)]', CircleNotch]
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
    <Icon size={12} weight="bold" className={Icon === CircleNotch ? 'animate-spin' : ''} />{text}
  </span>
}

/** Claude writes **bold** in its answers; shown as bold instead of asterisks. */
export function ClaudeText({ text }) {
  return <>{asText(text).split(/(\*\*[^*]+\*\*)/g).map((part, index) => (/^\*\*[^*]+\*\*$/.test(part) ? <strong key={index}>{part.slice(2, -2)}</strong> : part))}</>
}

// JSON with coloured keys, strings, numbers and booleans. Built from React elements, so nothing is injected as HTML.
const JSON_TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g
export function JsonView({ json }) {
  const parts = useMemo(() => {
    let text
    try {
      text = typeof json === 'string' ? JSON.stringify(JSON.parse(json), null, 2) : JSON.stringify(json, null, 2)
    } catch {
      text = String(json)
    }
    const out = []
    let last = 0
    for (const match of text.matchAll(JSON_TOKEN)) {
      if (match.index > last) out.push(text.slice(last, match.index))
      const token = match[0]
      const cls = token.startsWith('"')
        ? (/:\s*$/.test(token) ? 'font-bold text-[var(--accent-strong)] dark:text-(--lime)' : 'text-amber-700 dark:text-amber-300')
        : /^(true|false)$/.test(token) ? 'font-bold text-emerald-600 dark:text-emerald-400'
          : token === 'null' ? 'font-bold text-rose-500'
            : 'font-medium text-blue-600 dark:text-sky-300'
      out.push(<span key={match.index} className={cls}>{token}</span>)
      last = match.index + token.length
    }
    if (last < text.length) out.push(text.slice(last))
    return out
  }, [json])
  return <pre className="max-h-[24rem] overflow-auto whitespace-pre p-4 font-mono text-xs leading-relaxed text-[var(--ink)] selection:bg-(--lime) selection:text-[#26320b]">{parts}</pre>
}
