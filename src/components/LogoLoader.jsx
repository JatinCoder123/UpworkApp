import { Mark } from './ui'

export default function LogoLoader({ className = 'min-h-[55dvh]', label = 'Loading' }) {
  return <div role="status" aria-live="polite" className={`grid place-items-center ${className}`}>
    <div className="logo-loader-motion" aria-hidden="true">
      <Mark />
      <span className="logo-loader-shadow" />
    </div>
    <span className="sr-only">{label}</span>
  </div>
}
