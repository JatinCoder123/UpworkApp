import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ArrowUpRight } from '@phosphor-icons/react'
import { Mark } from './ui'

export default function LoginIntro({ onComplete }) {
  const root = useRef(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      const timer = window.setTimeout(onComplete, 700)
      return () => window.clearTimeout(timer)
    }

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ onComplete })
      timeline
        .fromTo('[data-intro-mark]', { scale: .35, rotate: -18, autoAlpha: 0 }, { scale: 1, rotate: 0, autoAlpha: 1, duration: .8, ease: 'back.out(1.8)' })
        .fromTo('[data-intro-orbit]', { scale: .65, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .6, ease: 'power3.out' }, '-=.5')
        .to('[data-intro-orbit]', { rotate: 180, duration: 1.25, ease: 'power2.inOut' }, '-=.35')
        .fromTo('[data-intro-word]', { y: 42, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .75, stagger: .07, ease: 'power4.out' }, '-=.75')
        .fromTo('[data-intro-rule]', { scaleX: 0 }, { scaleX: 1, duration: .65, ease: 'power3.inOut' }, '-=.55')
        .to('[data-intro-scene]', { scale: 1.035, autoAlpha: 0, duration: .65, ease: 'power3.inOut' }, '+=.65')
    }, root)
    return () => ctx.revert()
  }, [onComplete])

  return <div ref={root} data-intro-scene className="fixed inset-0 z-[100] overflow-hidden bg-[#11130f] text-white">
    <div aria-hidden="true" className="intro-grid absolute inset-0 opacity-30" />
    <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--lime)]/[.08] blur-[110px]" />
    <button type="button" onClick={onComplete} className="absolute right-5 top-5 z-20 rounded-full border border-white/15 px-4 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/55 transition-colors hover:border-white/30 hover:text-white sm:right-8 sm:top-8">Skip intro</button>

    <main className="relative grid min-h-[100dvh] place-items-center px-6">
      <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
        <div className="relative grid size-40 place-items-center sm:size-48">
          <div data-intro-orbit aria-hidden="true" className="intro-orbit absolute inset-0 rounded-full border border-white/15">
            <span className="absolute left-1/2 top-0 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--lime)] text-[var(--ink)] shadow-[0_0_40px_rgba(200,245,93,.38)]"><ArrowUpRight size={16} weight="bold" /></span>
          </div>
          <div data-intro-mark className="scale-[1.8] sm:scale-[2.15]"><Mark dark /></div>
        </div>

        <div className="mt-10 overflow-hidden pb-1">
          <h1 data-intro-word className="text-[clamp(2.8rem,8vw,6.5rem)] font-semibold leading-none tracking-[-.075em]">UpWorkApp</h1>
        </div>
        <div data-intro-rule aria-hidden="true" className="mt-5 h-px w-24 origin-center bg-[var(--lime)]" />
        <p data-intro-word className="mt-5 text-[10px] font-semibold uppercase tracking-[.34em] text-white/45 sm:text-xs">Opportunity, in motion</p>
      </div>
    </main>

    <div className="absolute bottom-6 left-6 text-[9px] font-medium uppercase tracking-[.22em] text-white/25 sm:bottom-8 sm:left-8">Secure workspace</div>
    <div className="absolute bottom-6 right-6 text-[9px] font-medium uppercase tracking-[.22em] text-white/25 sm:bottom-8 sm:right-8">Microsoft verified</div>
  </div>
}
