import { useState } from 'react'
import { ArrowSquareOut, Check, Copy, Key } from '@phosphor-icons/react'

// WordPress login of the sites, where a ready document is published. Override with VITE_PUBLISH_SITE_URL.
const PUBLISH_SITE_URL = import.meta.env?.VITE_PUBLISH_SITE_URL || 'https://sites.outrightcrm.in/wp-login.php?4dx-one'

// "Login URL" pill: clicking opens the address, the icon copies it, hovering shows it in a tooltip above. The pill
// never changes size (a growing pill made its row of buttons relayout and wrap on every hover, which lagged).
export default function LoginUrlPill() {
  const [copied, setCopied] = useState(false)
  const shownUrl = PUBLISH_SITE_URL.replace(/^https?:\/\//, '')
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(PUBLISH_SITE_URL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Copy the login URL', PUBLISH_SITE_URL)
    }
  }
  return (
    <div className="group/login relative flex min-w-0 items-center rounded-full bg-[var(--paper)] ring-1 ring-[var(--line)] transition-shadow duration-300 hover:ring-[var(--lime-dark)] focus-within:ring-[var(--lime-dark)]">
      <a
        href={PUBLISH_SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-1.5 py-1.5 pl-3 pr-1.5 text-[11px] font-bold text-[var(--ink)]"
      >
        <Key size={13} weight="bold" className="shrink-0 text-[var(--accent-strong)]" />
        <span className="shrink-0">Login URL</span>
        <ArrowSquareOut size={12} className="shrink-0 text-[var(--muted)]" />
      </a>
      {/* Floats above the pill (out of the layout): only its opacity and position animate. */}
      <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 translate-y-1 whitespace-nowrap rounded-lg bg-[var(--ink)] px-2.5 py-1.5 font-mono text-[10px] font-medium text-white opacity-0 shadow-[0_10px_30px_rgb(var(--shadow-rgb)/.18)] transition-[opacity,transform] duration-200 group-hover/login:translate-y-0 group-hover/login:opacity-100 group-focus-within/login:translate-y-0 group-focus-within/login:opacity-100">
        {shownUrl}
      </span>
      <button
        type="button"
        onClick={copyUrl}
        aria-label={copied ? 'Login URL copied' : 'Copy login URL'}
        title={copied ? 'Copied' : 'Copy login URL'}
        className="mr-1 grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]"
      >
        {copied ? <Check size={12} weight="bold" className="text-[var(--accent-strong)]" /> : <Copy size={12} />}
      </button>
    </div>
  )
}
