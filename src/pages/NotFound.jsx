import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Briefcase } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import ThemeToggle from '../components/ThemeToggle'
import { Mark, primaryButton } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'

function RobotIllustration({ className = 'size-72' }) {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Antenna */}
      <line x1="120" y1="28" x2="120" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="120" cy="24" r="4" stroke="currentColor" strokeWidth="2" fill="var(--lime)" />

      {/* Head */}
      <rect x="92" y="44" width="56" height="42" rx="6" stroke="currentColor" strokeWidth="2" fill="var(--paper)" />
      {/* Eyes */}
      <circle cx="107" cy="58" r="3" fill="currentColor" />
      <circle cx="133" cy="58" r="3" fill="currentColor" />
      {/* Eyebrows */}
      <line x1="102" y1="52" x2="112" y2="54" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="128" y1="54" x2="138" y2="52" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Zigzag mouth */}
      <path d="M106 72 l4 -3 l5 3 l5 -3 l5 3 l4 -3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Ears / screws */}
      <rect x="86" y="58" width="6" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <rect x="148" y="58" width="6" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />

      {/* Neck */}
      <line x1="114" y1="86" x2="114" y2="94" stroke="currentColor" strokeWidth="2" />
      <line x1="126" y1="86" x2="126" y2="94" stroke="currentColor" strokeWidth="2" />

      {/* Body */}
      <rect x="80" y="94" width="80" height="70" rx="8" stroke="currentColor" strokeWidth="2" fill="var(--paper)" />
      {/* Chest meter */}
      <rect x="96" y="106" width="48" height="26" rx="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <line x1="104" y1="124" x2="118" y2="113" stroke="var(--lime-dark)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="104" cy="124" r="2" fill="currentColor" />
      {/* Dial ticks */}
      <line x1="102" y1="112" x2="105" y2="115" stroke="currentColor" strokeWidth="1.2" />
      <line x1="120" y1="110" x2="120" y2="114" stroke="currentColor" strokeWidth="1.2" />
      <line x1="138" y1="112" x2="135" y2="115" stroke="currentColor" strokeWidth="1.2" />

      {/* Chest buttons */}
      <line x1="96" y1="146" x2="144" y2="146" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="4 4" />
      <circle cx="106" cy="154" r="2.5" fill="currentColor" />
      <circle cx="120" cy="154" r="2.5" fill="var(--lime-dark)" />
      <circle cx="134" cy="154" r="2.5" fill="currentColor" />

      {/* Left arm holding wrench */}
      <path d="M80 108 c-12 0 -24 -6 -30 -18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 90 c-4 -2 -6 -8 -4 -12 c2 -4 8 -6 12 -4" stroke="currentColor" strokeWidth="2" fill="none" />
      <g transform="translate(42, 60) rotate(-35)">
        <path d="M0 12 L0 36 M-4 36 L4 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M-6 8 C-6 2 6 2 6 8 L4 10 L-4 10 Z" stroke="currentColor" strokeWidth="2" fill="var(--paper)" />
      </g>

      {/* Right arm hanging */}
      <path d="M160 108 c10 4 18 14 20 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

      {/* Broken leg stumps */}
      <rect x="94" y="164" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <rect x="130" y="164" width="16" height="8" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none" />

      {/* Scattered parts */}
      <rect x="134" y="180" width="14" height="24" rx="4" transform="rotate(35 134 180)" stroke="currentColor" strokeWidth="1.8" fill="var(--paper)" />
      <path d="M72 198 h22 c3 0 5 2 5 5 v3 h-27 z" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M172 182 c-4 -4 -8 -2 -7 2 c1 4 6 5 6 9 c0 4 -6 5 -6 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* Loose gear */}
      <circle cx="106" cy="192" r="6" stroke="currentColor" strokeWidth="1.6" fill="var(--paper)" />
      <circle cx="106" cy="192" r="2" fill="currentColor" />
      <line x1="106" y1="184" x2="106" y2="186" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="106" y1="198" x2="106" y2="200" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="98" y1="192" x2="100" y2="192" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="112" y1="192" x2="114" y2="192" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />

      {/* Screws */}
      <path d="M164 168 l6 6 M168 165 l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="190" cy="195" r="2" fill="currentColor" />

      {/* Floor baseline */}
      <line x1="68" y1="212" x2="178" y2="212" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" strokeDasharray="8 6 18 8" />
    </svg>
  )
}

export default function NotFound({
  title = '404. Page not found.',
  message,
  backTo = '/tech-news',
  backLabel = 'Back to Tech News',
}) {
  const { status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isAuthenticated = status === 'authenticated'

  const currentPath = location.pathname + (location.search || '')
  const targetBackTo = isAuthenticated ? backTo : '/login'
  const targetBackLabel = isAuthenticated ? backLabel : 'Return to sign in'

  const content = (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 md:py-24">
      <div className="grid items-center gap-12 md:grid-cols-[1.1fr_auto] lg:gap-20">
        {/* Left: Branding, Heading, URL details & Actions */}
        <div className="max-w-xl space-y-6">
          <Link
            to={isAuthenticated ? "/tech-news" : "/login"}
            className="inline-flex items-center gap-2.5 text-base font-bold tracking-tight text-[var(--ink)]"
          >
            <Mark />
            <span>UpWorkApp</span>
          </Link>

          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--ink)]">
              {title === '404. Page not found.' ? (
                <>
                  <span className="font-extrabold text-[var(--ink)]">404.</span> Page not found.
                </>
              ) : (
                title
              )}
            </h1>
            <p className="mt-4 text-sm sm:text-base leading-7 text-[var(--muted)]">
              {message || (
                <>
                  The requested URL{' '}
                  <code className="break-all rounded-md bg-black/[.06] dark:bg-white/10 px-2 py-0.5 font-mono text-xs font-bold text-[var(--ink)]">
                    {currentPath}
                  </code>{' '}
                  was not found on this server. <span className="font-semibold text-[var(--ink)]">That’s all we know.</span>
                </>
              )}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to={targetBackTo} className={primaryButton}>
              <span>{targetBackLabel}</span>
              <span className="grid size-7 place-items-center rounded-full bg-white/15">
                <ArrowRight size={13} />
              </span>
            </Link>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] ring-1 ring-black/10 dark:ring-white/10 transition-all hover:bg-black/5 dark:hover:bg-white/5 shadow-2xs"
            >
              <ArrowLeft size={13} />
              <span>Go back</span>
            </button>

            {isAuthenticated && targetBackTo !== '/jobs' && (
              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] ring-1 ring-black/10 dark:ring-white/10 transition-all hover:bg-black/5 dark:hover:bg-white/5 shadow-2xs"
              >
                <Briefcase size={13} />
                <span>Opportunities</span>
              </Link>
            )}

            {isAuthenticated && targetBackTo !== '/tech-news' && (
              <Link
                to="/tech-news"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] ring-1 ring-black/10 dark:ring-white/10 transition-all hover:bg-black/5 dark:hover:bg-white/5 shadow-2xs"
              >
                <span>Tech News</span>
              </Link>
            )}
          </div>
        </div>

        {/* Right: Robot Illustration (Directly in the page flow without any container box) */}
        <div className="flex items-center justify-center text-[var(--muted)]/80 sm:pr-4">
          <RobotIllustration className="size-60 sm:size-72 lg:size-80 text-[var(--muted)] dark:text-[var(--text)] transition-transform duration-500 hover:scale-105" />
        </div>
      </div>
    </main>
  )

  if (isAuthenticated) {
    return <Shell>{content}</Shell>
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--paper)]">
      <header className="px-4 pt-4 sm:px-6 md:pt-6">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between rounded-full bg-[var(--surface)]/90 px-4 py-2 ring-1 ring-black/5 shadow-xs backdrop-blur-xl">
          <Link
            to="/login"
            className="flex items-center gap-2.5 pr-3 text-sm font-bold tracking-[-.02em] text-[var(--ink)]"
          >
            <Mark />
            <span>UpWorkApp</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded-full bg-[var(--ink)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>
      {content}
    </div>
  )
}
