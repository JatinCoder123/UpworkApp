import { Mark } from './ui'

export default function LogoLoader({ className = 'min-h-[55dvh]', label = 'Loading' }) {
  return <div role="status" aria-live="polite" className={`grid place-items-center ${className}`}>
    <div className="logo-loader-morph" aria-hidden="true">
      <span className="logo-loader-dot-ring"><i /><i /><i /><i /></span>
      <span className="logo-loader-circle" />
      <span className="logo-loader-mark"><Mark /></span>
    </div>
    <span className="sr-only">{label}</span>
  </div>
}
