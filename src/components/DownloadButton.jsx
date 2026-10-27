import { useState } from 'react'
import { CircleNotch, DownloadSimple, WarningCircle } from '@phosphor-icons/react'
import { downloadFile } from '../services/api'

/*
 * Download for a generated file's CRM link: saves the file where the user is, instead of a link opening a new tab.
 * While it loads the icon spins. When the CRM answers that the file is not there, that is said beside the button;
 * when the CRM cannot be reached this way, the link opens as before so the file is still reachable.
 * The text size comes from the parent (index.css gives buttons `font: inherit`).
 */
export default function DownloadButton({ url, filename = '', className = '', iconSize = 13, children = 'Download' }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const download = async () => {
    setBusy(true)
    setProblem('')
    try {
      await downloadFile(url, { filename })
    } catch (error) {
      if (error?.code !== 'DOC_DOWNLOAD_FAILED') window.open(url, '_blank', 'noopener')
      else setProblem(error.status === 404 ? 'The file is not in the CRM.' : 'It could not be downloaded; try again.')
    } finally {
      setBusy(false)
    }
  }
  return <>
    <button type="button" onClick={download} disabled={busy} aria-busy={busy} className={className}>
      {busy ? <CircleNotch size={iconSize} weight="bold" className="animate-spin" /> : <DownloadSimple size={iconSize} weight="bold" />}
      {busy ? 'Downloading…' : children}
    </button>
    {problem && <span role="alert" className="inline-flex items-center gap-1 text-[var(--bad)]"><WarningCircle size={iconSize} weight="fill" />{problem}</span>}
  </>
}
