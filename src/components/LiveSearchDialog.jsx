import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Crosshair, MagnifyingGlass, Plus, WarningCircle, X } from '@phosphor-icons/react'
import { DialogHeader, Modal } from './ui'
import { api } from '../services/api'
import { LIVE_WINDOWS, loadLiveResult, loadLiveSettings, newSince, saveLiveResult, saveLiveSettings, scanSteps, windowLabel } from '../lib/liveJobs'

const label = 'text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]'

// Runs the live Upwork scan from the jobs feed and opens /live-jobs with the results.
export default function LiveSearchDialog({ skillRecords = [], skillsLoading = false, onClose }) {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(loadLiveSettings)
  const [draft, setDraft] = useState('')
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const controller = useRef(null)

  const scan = useMutation({
    mutationFn: (params) => {
      controller.current = new AbortController()
      return api.getLiveJobs({ ...params, signal: controller.current.signal })
    },
    onSuccess: (data) => {
      const justIn = newSince(loadLiveResult(), data)
      saveLiveResult(data)
      navigate('/live-jobs', { state: { justIn, fromSearch: true } })
    },
  })
  const scanning = scan.isPending
  const steps = scanSteps(settings.skills, windowLabel(settings.minutes))

  useEffect(() => {
    if (!scanning) return undefined
    const stepTimer = window.setInterval(() => setStep((current) => Math.min(current + 1, steps.length - 1)), 1400)
    const clock = window.setInterval(() => setElapsed((current) => current + 1), 1000)
    return () => { window.clearInterval(stepTimer); window.clearInterval(clock) }
  }, [scanning, steps.length])
  useEffect(() => () => controller.current?.abort(), [])

  const update = (patch) => setSettings((current) => { const next = { ...current, ...patch }; saveLiveSettings(next); return next })
  const toggleSkill = (name) => update({ skills: settings.skills.includes(name) ? settings.skills.filter((item) => item !== name) : [...settings.skills, name] })
  const addSkill = () => {
    const value = draft.trim()
    if (value && !settings.skills.some((item) => item.toLowerCase() === value.toLowerCase())) update({ skills: [...settings.skills, value] })
    setDraft('')
  }
  const start = () => { if (!settings.skills.length || scanning) return; setStep(0); setElapsed(0); scan.mutate(settings) }
  const stop = () => { controller.current?.abort(); scan.reset() }
  const known = new Set(skillRecords.map((record) => record.name.toLowerCase()))
  const custom = settings.skills.filter((skill) => !known.has(skill.toLowerCase()))

  return <Modal onClose={onClose} wide>
    <DialogHeader eyebrow="Live from Upwork" title="Search jobs live" onClose={onClose} />
    <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">Scan Upwork directly for fresh posts in your skills, before they reach the feed.</p>

    {scanning ? <div className="live-hero mt-7 grid gap-6 rounded-[1.6rem] p-6 sm:grid-cols-[9rem_1fr] sm:items-center" role="status" aria-live="polite">
      <div className="mx-auto w-36"><div className="live-scope" data-scanning="true"><span className="live-ping" /><span className="live-ping" /><span className="live-sweep" /><span className="absolute left-1/2 top-1/2 z-[1] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c8e875] shadow-[0_0_20px_#c8e875]" /></div></div>
      <div className="min-w-0">
        <p className="flex items-center justify-between text-[11px] font-semibold text-white/50"><span>Scanning the last {windowLabel(settings.minutes)}</span><span className="font-mono">{elapsed}s</span></p>
        <ol className="mt-3 space-y-2">{steps.map((text, index) => <li key={text} className={`flex items-center gap-2.5 text-xs font-semibold transition-opacity duration-300 ${index > step ? 'opacity-25' : 'opacity-100'} ${index < step ? 'text-white/55' : 'text-white'}`}>
          {index < step ? <span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-[#c8e875] text-[8px] text-[#1d2810]">✓</span> : <span className={`size-3.5 shrink-0 rounded-full border-2 border-white/20 ${index === step ? 'animate-spin border-t-[#c8e875]' : ''}`} />}
          {text}
        </li>)}</ol>
        <button type="button" onClick={stop} className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/15 hover:bg-white/15"><X size={12} weight="bold" />Stop</button>
      </div>
    </div>
      : <>
        <div className="mt-7 flex items-center justify-between gap-3">
          <p className={label}>Skills to scan{settings.skills.length > 0 && <span className="ml-2 rounded-full bg-[var(--ink)] px-1.5 py-0.5 text-white">{settings.skills.length}</span>}</p>
          {settings.skills.length > 0 && <button type="button" onClick={() => update({ skills: [] })} className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear</button>}
        </div>
        <div className="mt-3 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {skillRecords.map(({ id, name }) => <button key={id} type="button" aria-pressed={settings.skills.includes(name)} onClick={() => toggleSkill(name)} className="skill-tag rounded-full px-3 py-1.5 text-[11px] font-semibold">{name}</button>)}
          {custom.map((name) => <button key={name} type="button" aria-pressed="true" onClick={() => toggleSkill(name)} className="skill-tag inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold">{name}<X size={10} weight="bold" /></button>)}
          {skillsLoading && <span className="skeleton-bone h-7 w-40 rounded-full" />}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); addSkill() }} className="mt-3 flex items-center gap-2 rounded-full bg-[var(--paper)] py-1 pl-4 pr-1 ring-1 ring-black/5 focus-within:ring-[var(--lime-dark)]">
          <MagnifyingGlass size={14} className="shrink-0 text-[var(--muted)]" />
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add any skill, e.g. Laravel" aria-label="Add a skill" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
          <button type="submit" disabled={!draft.trim()} aria-label="Add skill" className="grid size-8 place-items-center rounded-full bg-[var(--ink)] text-white disabled:opacity-30"><Plus size={13} weight="bold" /></button>
        </form>

        <div className="mt-6 flex flex-wrap items-end gap-4 border-t border-[var(--line)]/70 pt-5">
          <div>
            <p className={label}>Posted within</p>
            <div className="mt-2 flex flex-wrap gap-1 rounded-full bg-[var(--paper)] p-1" role="radiogroup" aria-label="Posted within">
              {LIVE_WINDOWS.map((item) => <button key={item.minutes} type="button" role="radio" aria-checked={settings.minutes === item.minutes} onClick={() => update({ minutes: item.minutes })} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${settings.minutes === item.minutes ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item.label}</button>)}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 pb-1.5 text-[11px] font-semibold text-[var(--muted)]">
            <input type="checkbox" checked={settings.includeRenewed} onChange={(event) => update({ includeRenewed: event.target.checked })} className="peer sr-only" />
            <span className="relative h-5 w-9 rounded-full bg-black/10 transition-colors peer-checked:bg-[var(--lime-dark)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--lime-dark)]/50 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4 dark:bg-white/15" />
            Include renewed posts
          </label>
        </div>

        {scan.isError && scan.error?.code !== 'ABORTED' && <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />{scan.error?.message || 'The live scan failed.'}</p>}

        <button type="button" onClick={start} disabled={!settings.skills.length} className="upwork-apply-button mt-6 flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-sm font-bold disabled:pointer-events-none disabled:opacity-40">
          <Crosshair size={18} weight="bold" className="relative z-10" /><span className="relative z-10">{settings.skills.length ? `Scan ${settings.skills.length} skill${settings.skills.length === 1 ? '' : 's'} live` : 'Pick a skill to scan'}</span>
        </button>
      </>}
  </Modal>
}
