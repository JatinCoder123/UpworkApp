import { useEffect, useState } from 'react'
import { ArrowRight, Brain, Check, Flask, GameController, Lightbulb, ListChecks, MagnifyingGlass, ShieldCheck, Timer, Trophy, X } from '@phosphor-icons/react'
import { CHECK_CATEGORIES } from '../../services/domainApi'
import { CATEGORY_ICONS } from './meta'

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  if (!startedAt) return '0:00'
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const STEPS = [
  { label: 'Brainstorm', detail: 'AI coins brandable names', icon: Brain },
  { label: 'Registry check', detail: 'Live availability in batches', icon: MagnifyingGlass },
  { label: 'Shortlist', detail: 'Keep only free names', icon: ListChecks },
  { label: 'Deep screening', detail: '43 checks + web research', icon: ShieldCheck },
]

function Pipeline({ step }) {
  return <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {STEPS.map(({ label, detail, icon: Icon }, index) => {
      const state = index < step ? 'done' : index === step ? 'active' : 'todo'
      return <li key={label} className={`relative rounded-2xl p-3 ring-1 transition-all duration-500 ${state === 'active' ? 'bg-white/12 ring-[var(--lime-tint)]/60' : state === 'done' ? 'bg-white/[.06] ring-white/10' : 'ring-white/[.07]'}`}>
        <span className={`grid size-8 place-items-center rounded-xl transition-colors duration-500 ${state === 'todo' ? 'bg-white/[.06] text-white/40' : 'bg-[var(--lime)] text-[var(--on-lime)]'}`}>
          {state === 'done' ? <Check size={15} weight="bold" /> : <Icon size={15} weight="bold" className={state === 'active' ? 'domain-pulse-dot' : ''} />}
        </span>
        <p className={`mt-2.5 text-xs font-bold ${state === 'todo' ? 'text-white/45' : 'text-white'}`}>{label}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-white/50">{detail}</p>
      </li>
    })}
  </ol>
}

const LETTERS = 'abcdefghijklmnoprstuvyz'
const randomName = () => Array.from({ length: 5 + Math.floor(Math.random() * 4) }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('')

/** Decorative "slot machine" shown before the AI has returned its first names. */
function ScrambleChips() {
  const [names, setNames] = useState(() => Array.from({ length: 9 }, randomName))
  useEffect(() => {
    if (reduceMotion()) return undefined
    const timer = setInterval(() => setNames((current) => current.map((name) => (Math.random() < .45 ? randomName() : name))), 110)
    return () => clearInterval(timer)
  }, [])
  return <div className="flex flex-wrap gap-2" aria-hidden="true">
    {names.map((name, index) => <span key={index} className="rounded-full bg-white/[.07] px-3.5 py-2 font-mono text-xs text-white/45 ring-1 ring-white/10">{name}<span className="text-white/25">.com</span></span>)}
  </div>
}

function CandidateStream({ candidates }) {
  const visible = candidates.slice(-36)
  return <ul className="flex flex-wrap gap-2" aria-label="Names checked so far">
    {visible.map((candidate, index) => <li key={candidate.domain} style={{ '--i': index % 25 }} className={`domain-chip-in inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-mono text-xs ring-1 transition-colors duration-500 ${candidate.status === 'free' ? 'bg-[var(--lime)] text-[var(--on-lime)] ring-[var(--lime-dark)] shadow-[0_8px_24px_color-mix(in_srgb,var(--lime)_25%,transparent)]' : candidate.status === 'taken' ? 'bg-white/[.04] text-white/60 ring-white/10' : candidate.status === 'unknown' ? 'bg-white/[.04] text-white/50 ring-white/10' : 'bg-white/[.08] text-white ring-white/15'}`}>
      {candidate.status === 'checking' && <span className="domain-pulse-dot size-1.5 rounded-full bg-[var(--lime)]" />}
      {candidate.status === 'free' && <Check size={12} weight="bold" />}
      {candidate.status === 'taken' && <X size={11} weight="bold" className="text-white/45" />}
      <span className={candidate.status === 'taken' ? 'domain-taken' : ''}>{candidate.domain}</span>
      <span className="sr-only">{candidate.status === 'free' ? 'available' : candidate.status === 'taken' ? 'taken' : candidate.status === 'unknown' ? 'unknown' : 'checking'}</span>
    </li>)}
  </ul>
}

function Stat({ value, label }) {
  return <div><p key={value} className="domain-ticker text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tabular-nums leading-none tracking-[-.05em]">{value}</p><p className="mt-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-white/50">{label}</p></div>
}

export function NamingLab({ lab, startedAt, subject }) {
  const elapsed = useElapsed(startedAt)
  const checked = lab.candidates.filter((candidate) => candidate.status !== 'checking').length
  const free = lab.candidates.filter((candidate) => candidate.status === 'free').length
  const headline = [
    'Coining fresh names',
    'Asking the registry, name by name',
    free ? `${free} free ${free === 1 ? 'name' : 'names'} so far` : 'Filtering out the taken ones',
  ][Math.min(lab.step, 2)]

  return <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-[var(--ink)] p-5 text-white shadow-[0_28px_80px_rgb(var(--shadow-rgb)/.22)] sm:p-8" aria-live="polite" aria-busy="true">
    <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[var(--lime-tint)]/15 blur-3xl" />
    <div className="relative flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--hero-accent)]"><Flask size={14} weight="fill" />Naming lab · round {lab.round || 1} of 5</p>
        <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold leading-[1.02] tracking-[-.05em]">{headline}</h2>
        {subject && <p className="mt-2 line-clamp-1 max-w-2xl text-xs text-white/55">for “{subject}”</p>}
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[.08] px-3 py-1.5 font-mono text-xs ring-1 ring-white/10"><Timer size={13} weight="bold" />{elapsed}</span>
    </div>
    <div className="relative mt-6"><Pipeline step={lab.step} /></div>
    <div className="relative mt-6 min-h-24 rounded-[1.5rem] bg-black/15 p-4 ring-1 ring-white/[.06]">
      {lab.candidates.length ? <CandidateStream candidates={lab.candidates} /> : <ScrambleChips />}
    </div>
    <div className="relative mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
      <Stat value={lab.candidates.length} label="Names coined" />
      <Stat value={checked} label="Checked" />
      <Stat value={free} label="Free to register" />
    </div>
  </section>
}

const TIPS = [
  'Say it out loud. If you have to spell it, you will lose word-of-mouth traffic.',
  'Renewal price matters more than the first-year promo price.',
  'Hyphens and numbers fail the radio test: nobody hears them correctly.',
  'Grab matching social handles early; consistent handles compound recall.',
  'A name that is not tied to one product leaves room to grow.',
  'Shorter labels are faster to type on a phone keyboard.',
  'Check how the name reads in other major languages before you commit.',
]

export function ScreeningBanner({ startedAt, count }) {
  const elapsed = useElapsed(startedAt)
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setIndex((value) => value + 1), 2600)
    return () => clearInterval(timer)
  }, [])
  const category = CHECK_CATEGORIES[index % CHECK_CATEGORIES.length]
  const Icon = CATEGORY_ICONS[category]
  const tip = TIPS[Math.floor(index / 2) % TIPS.length]
  return <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-[var(--ink)] p-5 text-white sm:p-6" role="status" aria-live="off">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} weight="fill" className="text-[var(--hero-accent)]" />Deep-screening {count} {count === 1 ? 'name' : 'names'} across 43 checks</p>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[.08] px-3 py-1 font-mono text-xs ring-1 ring-white/10"><Timer size={13} weight="bold" />{elapsed}</span>
    </div>
    <div className="mt-4 flex flex-wrap gap-1.5">
      {CHECK_CATEGORIES.map((name, itemIndex) => {
        const CategoryIcon = CATEGORY_ICONS[name]
        return <span key={name} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all duration-500 ${itemIndex === index % CHECK_CATEGORIES.length ? 'bg-[var(--lime)] text-[var(--on-lime)]' : 'bg-white/[.06] text-white/50'}`}><CategoryIcon size={11} weight="bold" />{name}</span>
      })}
    </div>
    <p key={category} className="domain-ticker mt-4 flex items-center gap-2 text-xs text-white/70">{Icon && <Icon size={13} />}Researching {category.toLowerCase()} signals on the live web… this can take a couple of minutes.</p>
    <p key={tip} className="domain-ticker mt-3 flex items-start gap-2 border-t border-white/10 pt-3 text-xs leading-5 text-white/80"><Lightbulb size={14} weight="fill" className="mt-0.5 shrink-0 text-[var(--hero-accent)]" />{tip}</p>
  </div>
}

const QUIZ = [
  { question: 'What was the first .com domain ever registered (March 1985)?', options: ['ibm.com', 'symbolics.com', 'apple.com'], answer: 1 },
  { question: '.ai is the country-code extension of which place?', options: ['Anguilla', 'Albania', 'United Arab Emirates'], answer: 0 },
  { question: '.io officially belongs to…', options: ['Isle of Man', 'India', 'British Indian Ocean Territory'], answer: 2 },
  { question: 'How many characters can a single domain label have at most?', options: ['32', '63', '128'], answer: 1 },
  { question: 'Voice.com sold in 2019 for roughly…', options: ['$3 million', '$30 million', '$300,000'], answer: 1 },
  { question: '.co is the country-code extension of…', options: ['Colombia', 'Cook Islands', 'Congo'], answer: 0 },
  { question: 'Which character is NOT allowed in a domain name?', options: ['Hyphen (-)', 'Digit (7)', 'Underscore (_)'], answer: 2 },
  { question: 'In which year was google.com registered?', options: ['1995', '1997', '1999'], answer: 1 },
]

function TriviaQuiz() {
  const [order] = useState(() => QUIZ.map((_, index) => index).sort(() => Math.random() - .5))
  const [position, setPosition] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const item = QUIZ[order[position % order.length]]
  const choose = (index) => {
    if (picked !== null) return
    setPicked(index)
    setScore((current) => ({ right: current.right + (index === item.answer ? 1 : 0), total: current.total + 1 }))
  }
  const next = () => { setPicked(null); setPosition((value) => value + 1) }

  return <div className="rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)] sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]"><GameController size={15} weight="duotone" />Domain trivia</p>
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lime-tint)]/35 px-2.5 py-1 text-[10px] font-bold"><Trophy size={11} weight="fill" />{score.right}/{score.total}</span>
    </div>
    <p key={position} className="domain-ticker mt-4 text-base font-semibold leading-snug tracking-[-.02em]">{item.question}</p>
    <div className="mt-4 grid gap-2">
      {item.options.map((option, index) => {
        const state = picked === null ? 'idle' : index === item.answer ? 'right' : index === picked ? 'wrong' : 'muted'
        return <button key={option} type="button" onClick={() => choose(index)} disabled={picked !== null} className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold ring-1 transition-all duration-300 ${state === 'idle' ? 'bg-[var(--paper)] ring-[var(--line)] hover:-translate-y-0.5 hover:ring-[var(--lime-dark)]' : state === 'right' ? 'bg-[var(--ok-bg)] text-[var(--ok)] ring-[var(--ok)]/30' : state === 'wrong' ? 'bg-[var(--bad-bg)] text-[var(--bad)] ring-[var(--bad)]/30' : 'bg-[var(--paper)] opacity-50 ring-transparent'}`}>
          {option}{state === 'right' && <Check size={15} weight="bold" />}{state === 'wrong' && <X size={14} weight="bold" />}
        </button>
      })}
    </div>
    {picked !== null && <button type="button" onClick={next} className="domain-ticker mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-strong)]">Next question <ArrowRight size={13} weight="bold" /></button>}
  </div>
}

function testName(raw) {
  const label = String(raw || '').toLowerCase().trim().replace(/^https?:\/\//, '').split('.')[0].replace(/\s+/g, '')
  if (!label) return { label, checks: [], score: 0 }
  const vowels = (label.match(/[aeiouy]/g) || []).length
  const syllables = (label.match(/[aeiouy]+/g) || []).length
  const ratio = vowels / label.length
  const checks = [
    ['Short and sweet', label.length >= 3 && label.length < 12, `${label.length} characters`],
    ['Letters only', /^[a-z]+$/.test(label), /^[a-z]+$/.test(label) ? 'No digits or hyphens' : 'Digits/hyphens fail the radio test'],
    ['No double letters', !/([a-z])\1/.test(label), /([a-z])\1/.test(label) ? 'Easy to misspell' : 'Clean spelling'],
    ['Vowel balance', ratio >= .25 && ratio <= .6, `${Math.round(ratio * 100)}% vowels`],
    ['No tongue-twisters', !/[bcdfghjklmnpqrstvwxz]{4,}/.test(label), 'Consonant clusters'],
    ['Good rhythm', syllables >= 1 && syllables <= 3, `${syllables} ${syllables === 1 ? 'syllable' : 'syllables'}`],
  ].map(([title, pass, note]) => ({ title, pass, note }))
  return { label, checks, score: Math.round((checks.filter((check) => check.pass).length / checks.length) * 100) }
}

function NameTester({ onCheck }) {
  const [value, setValue] = useState('')
  const { label, checks, score } = testName(value)
  return <div className="rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)] sm:p-6">
    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]"><Lightbulb size={15} weight="duotone" />Test your own idea</p>
    <p className="mt-4 text-base font-semibold tracking-[-.02em]">Have a name in mind? Score it instantly.</p>
    <div className="mt-4 flex items-center gap-2 rounded-full bg-[var(--paper)] p-1.5 pl-4 ring-1 ring-[var(--line)] focus-within:ring-[var(--lime-dark)]">
      <input value={value} onChange={(event) => setValue(event.target.value)} maxLength={40} placeholder="e.g. lumora" aria-label="Name to test" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      {label && <span className="shrink-0 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-bold tabular-nums text-white">{score}</span>}
    </div>
    {label ? <>
      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {checks.map((check) => <li key={check.title} className="flex items-start gap-2 text-xs"><span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${check.pass ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--warn-bg)] text-[var(--warn)]'}`}>{check.pass ? <Check size={9} weight="bold" /> : <X size={9} weight="bold" />}</span><span><span className="font-semibold">{check.title}</span><span className="block text-[10px] text-[var(--muted)]">{check.note}</span></span></li>)}
      </ul>
      {onCheck && /^[a-z0-9-]+$/.test(label) && <button type="button" onClick={() => onCheck(label)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-strong)]">Put “{label}” in the search box <ArrowRight size={13} weight="bold" /></button>}
    </> : <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Type any name to see how it scores on length, spelling, rhythm and pronounceability.</p>}
  </div>
}

export function WhileYouWait({ onCheckName }) {
  return <div className="mt-4 grid gap-4 md:grid-cols-2">
    <TriviaQuiz />
    <NameTester onCheck={onCheckName} />
  </div>
}
