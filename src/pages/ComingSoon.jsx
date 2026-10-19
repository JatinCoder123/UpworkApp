import { Link } from 'react-router-dom'
import { ArrowRight, BracketsCurly, Brain, Cloud, Code, EnvelopeSimple, Globe, MagnifyingGlass, Newspaper, ShareNetwork, Sparkle, VideoCamera } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import { primaryButton } from '../components/ui'

export default function ComingSoon({
  title = 'Daily News',
  description = 'This module is currently being prepared and will be available in an upcoming release.',
  type = 'daily-news',
}) {
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
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 sm:px-6 md:pt-8">
        <section className="rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
          <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--paper)] text-[var(--ink)] ring-1 ring-black/5">
              <Icon size={26} weight="duotone" />
            </div>

            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--lime)] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#26320b] ring-1 ring-[var(--lime-dark)]/30 shadow-xs">
              <Sparkle size={13} weight="fill" />
              Coming Soon
            </span>

            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-[-.04em] text-[var(--ink)]">
              {title} is on the way.
            </h2>

            <p className="mx-auto mt-3 max-w-md text-xs sm:text-sm leading-6 text-[var(--muted)]">
              {description}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/jobs" className={primaryButton}>
                <span>Explore Jobs</span>
                <span className="grid size-7 place-items-center rounded-full bg-white/15">
                  <ArrowRight size={13} />
                </span>
              </Link>

              <Link
                to="/tech-news"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--paper)] px-5 py-2.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-black/10 dark:ring-white/10 transition-all hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span>Go to AI News</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  )
}
