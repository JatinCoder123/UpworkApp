import { useState, useRef, useEffect } from 'react'
import {
  Key,
  CaretDown,
  Plus,
  MagnifyingGlass,
  Check,
  ShieldCheck,
  X,
} from '@phosphor-icons/react'

export default function CredentialsDropdown({
  credentials = [],
  selectedCredential,
  onSelect,
  onCreateNew,
  isLoading = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleOutsideClick)
    return () => document.removeEventListener('pointerdown', handleOutsideClick)
  }, [])

  const filtered = credentials.filter((c) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      c.name?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    )
  })

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--paper)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--line)] shadow-xs hover:ring-[var(--lime-dark)] active:scale-95 transition-all"
        title="Select SuiteCRM Credential"
      >
        <span className="grid size-5 place-items-center rounded-full bg-[var(--lime)]/30 text-[var(--accent-strong)]">
          <Key size={12} weight="bold" />
        </span>
        <span className="max-w-[140px] truncate sm:max-w-[200px]">
          {selectedCredential ? selectedCredential.name : 'Select Credential'}
        </span>
        {selectedCredential && (
          <span
            className={`size-2 rounded-full ${
              /^active$/i.test(selectedCredential.status || '') ? 'bg-[var(--ok)] ring-2 ring-[var(--ok)]/25' : 'bg-gray-400'
            }`}
            title={selectedCredential.status}
          />
        )}
        <CaretDown size={12} className={`text-[var(--muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 z-50 w-[min(92vw,22rem)] rounded-2xl bg-[var(--surface)] p-2.5 ring-1 ring-black/10 shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:ring-white/15 backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header row with Create Button */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--line)]/50 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              SuiteCRM Credentials ({credentials.length})
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onCreateNew?.()
              }}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--lime)] px-2.5 py-1 text-[10px] font-bold text-[#26320b] hover:brightness-105 active:scale-95 transition-all shadow-xs"
            >
              <Plus size={11} weight="bold" />
              <span>Create New</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-2.5 top-2.5 text-[var(--muted)]">
              <MagnifyingGlass size={13} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search credentials..."
              className="w-full rounded-xl bg-[var(--paper)] py-1.5 pl-8 pr-7 text-xs font-medium text-[var(--ink)] ring-1 ring-[var(--line)] focus:outline-none focus:ring-1 focus:ring-[var(--lime-dark)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Default / Unset option */}
          <div className="mt-2 space-y-1 max-h-60 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => {
                onSelect?.(null)
                setIsOpen(false)
              }}
              className={`w-full flex items-center justify-between gap-2 rounded-xl p-2 text-left text-xs transition-colors ${
                !selectedCredential
                  ? 'bg-[var(--lime)]/15 font-bold text-[var(--accent-strong)] ring-1 ring-[var(--lime-dark)]/25'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-[var(--ink)]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[var(--paper)] text-[var(--muted)]">
                  <ShieldCheck size={14} />
                </span>
                <span className="truncate">Default SuiteCRM Agent Credentials</span>
              </div>
              {!selectedCredential && <Check size={14} weight="bold" className="text-[var(--lime-dark)]" />}
            </button>

            {/* List of credentials */}
            {isLoading ? (
              <div className="py-6 text-center text-xs text-[var(--muted)]">Loading credentials...</div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--muted)]">
                {search ? 'No credentials match your filter.' : 'No credentials found.'}
              </div>
            ) : (
              filtered.map((cred) => {
                const isSelected = selectedCredential?.id === cred.id
                const isActive = /^active$/i.test(cred.status || '')

                return (
                  <button
                    key={cred.id}
                    type="button"
                    onClick={() => {
                      onSelect?.(cred)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-start justify-between gap-2 rounded-xl p-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-[var(--lime)]/15 font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/35'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 text-[var(--ink)]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`size-2 shrink-0 rounded-full ${
                            isActive ? 'bg-[var(--ok)]' : 'bg-gray-400'
                          }`}
                        />
                        <span className="truncate font-semibold text-[var(--ink)]" title={cred.name}>
                          {cred.name}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[var(--muted)]">
                        {cred.productionFirstToken && (
                          <span className="font-mono text-[9px] opacity-75">
                            {cred.productionFirstToken.slice(0, 4)}•••{cred.productionFirstToken.slice(-4)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check size={14} weight="bold" className="text-[var(--lime-dark)] shrink-0 mt-1" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
