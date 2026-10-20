import { useState } from 'react'
import { Key, Globe, ShieldCheck, FloppyDisk, Sparkle } from '@phosphor-icons/react'
import { Modal, DialogHeader, primaryButton } from './ui'
import { api } from '../services/api'

// API type and status choices are the CRM's own dropdowns (from the gateway), never a list in this file.
export default function CreateCredentialModal({ isOpen, onClose, onSuccess, options }) {
  const apiTypes = options?.apiType || []
  const statuses = (options?.status || []).filter((option) => option.value)
  const [name, setName] = useState('')
  const [apiType, setApiType] = useState('')
  const [status, setStatus] = useState('')
  // Made from the API Playground, so it is ticked "API Playground" (is_payload) and shows up there.
  const [inPlayground, setInPlayground] = useState(true)
  const chosenStatus = status || statuses[0]?.value || ''
  const [token, setToken] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Please provide a name for this credential.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const res = await api.createCredential({
        name: trimmedName,
        apiType,
        status: chosenStatus,
        inPlayground,
        productionFirstToken: token.trim(),
        productionEndpoint: endpoint.trim(),
        description: description.trim(),
      })
      onSuccess?.({
        id: res.id,
        name: trimmedName,
        apiType,
        status: chosenStatus,
        productionFirstToken: token.trim(),
        productionEndpoint: endpoint.trim(),
        description: description.trim(),
      })
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to create credential')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <DialogHeader
        eyebrow="SuiteCRM Credentials Store"
        title="Create New Credential"
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
        {error && (
          <div className="rounded-xl bg-[var(--bad-bg)]/80 p-3 text-xs font-semibold text-[var(--bad)] ring-1 ring-[var(--bad)]/30">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">
            Credential Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-[var(--muted)]">
              <Key size={16} />
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OpenAI GPT-4 Production Key"
              className="w-full rounded-xl bg-[var(--paper)] py-2.5 pl-10 pr-4 text-xs font-medium text-[var(--ink)] ring-1 ring-[var(--line)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-dark)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">API / Platform Type</label>
            <select
              value={apiType}
              onChange={(e) => setApiType(e.target.value)}
              className="w-full rounded-xl bg-[var(--paper)] px-3.5 py-2.5 text-xs font-medium text-[var(--ink)] ring-1 ring-[var(--line)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-dark)]"
            >
              {apiTypes.map((t) => (
                <option key={t.value || 'none'} value={t.value}>
                  {t.label || '--None--'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">Status</label>
            <div className="flex items-center gap-2 pt-0.5">
              {statuses.map((option) => {
                const picked = chosenStatus === option.value
                const on = /^active$/i.test(option.value)
                return <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${picked ? (on ? 'bg-[var(--ok-bg)] text-[var(--ok)] ring-1 ring-[var(--ok)]/40' : 'bg-black/5 dark:bg-white/10 text-[var(--ink)] ring-1 ring-[var(--line)]') : 'bg-[var(--paper)] text-[var(--muted)] ring-1 ring-[var(--line)] hover:text-[var(--ink)]'}`}>
                  {on ? '●' : '○'} {option.label}
                </button>
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">
            API Key / Token
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-[var(--muted)]">
              <ShieldCheck size={16} />
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="sk-... or authorization bearer token"
              className="w-full rounded-xl bg-[var(--paper)] py-2.5 pl-10 pr-4 font-mono text-xs font-medium text-[var(--ink)] ring-1 ring-[var(--line)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-dark)]"
            />
          </div>
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Stored encrypted in SuiteCRM credentials repository.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">
            Endpoint URL (Optional)
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-[var(--muted)]">
              <Globe size={16} />
            </span>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full rounded-xl bg-[var(--paper)] py-2.5 pl-10 pr-4 text-xs font-medium text-[var(--ink)] ring-1 ring-[var(--line)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-dark)]"
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-[var(--paper)] px-3.5 py-2.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--line)]">
          <input type="checkbox" checked={inPlayground} onChange={(event) => setInPlayground(event.target.checked)} className="size-4 accent-[var(--lime-dark)]" />
          Show in API Playground
          <span className="ml-auto text-[10px] font-medium text-[var(--muted)]">the CRM's "API Playground" checkbox</span>
        </label>

        <div>
          <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">Description / Purpose</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief notes on what this API key is used for..."
            className="w-full rounded-xl bg-[var(--paper)] p-3 text-xs font-medium text-[var(--ink)] ring-1 ring-[var(--line)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-dark)]"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[var(--line)]/60 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full bg-[var(--paper)] px-4 py-2 text-xs font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] hover:text-[var(--ink)] active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className={`${primaryButton} !py-2 !px-5 text-xs font-bold`}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-1.5">
                <Sparkle size={14} className="animate-spin text-[var(--lime)]" />
                <span>Saving to SuiteCRM...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <FloppyDisk size={14} weight="bold" />
                <span>Save Credential</span>
              </span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
