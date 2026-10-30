import { Link } from 'react-router-dom'
import { ArrowRight, BracketsCurly, Brain, Cloud, Code, EnvelopeSimple, Globe, MagnifyingGlass, Newspaper, ShareNetwork, Sparkle, VideoCamera } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import { primaryButton } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { canAccess, homePath } from '../lib/permissions'

export default function ComingSoon({
  title = 'Daily News',
  description = 'This module is currently being prepared and will be available in an upcoming release.',
  type = 'daily-news',
  children,
}) {
  const { user } = useAuth()
  const icons = {
    domain: Globe,
    video: VideoCamera,
    seo: MagnifyingGlass,
    appscript: Code,
    llm: Brain,
    wordpress: Globe,
    cloud: Cloud,
    social: ShareNetwork,
    'email-to-blog': EnvelopeSimple,
    'api-playground': BracketsCurly,
  }
  const Icon = icons[type] || Newspaper

  return (
    <Shell>
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-4 sm:px-6 md:pt-6">
        <section className="rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70">
          <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--paper)] text-[var(--ink)] ring-1 ring-black/5">
              <Icon size={26} weight="duotone" />
            </div>

            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--lime)] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--on-lime)] ring-1 ring-[var(--lime-dark)]/30 shadow-xs">
              <Sparkle size={13} weight="fill" />
              Coming Soon
            </span>

            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-[-.04em] text-[var(--ink)]">
              {title} is on the way.
            </h1>

            <p className="mx-auto mt-3 max-w-md text-xs sm:text-sm leading-6 text-[var(--muted)]">
              {description}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {/* Only sections the user's role can open; otherwise their own workspace. */}
              <Link to={canAccess(user, '/jobs') ? '/jobs' : homePath(user)} className={primaryButton}>
                <span>{canAccess(user, '/jobs') ? 'Explore Jobs' : 'Back to your workspace'}</span>
                <span className="grid size-7 place-items-center rounded-full bg-white/15">
                  <ArrowRight size={13} />
                </span>
              </Link>

              {canAccess(user, '/tech-news') && <Link
                to="/tech-news"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--paper)] px-5 py-2.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-black/10 dark:ring-white/10 transition-all hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span>Go to AI News</span>
              </Link>}
            </div>
            {children}
          </div>
        </section>
      </main>
    </Shell>
  )
}
