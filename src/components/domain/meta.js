import { CurrencyDollar, GlobeHemisphereWest, MagnifyingGlass, Megaphone, Ruler, Scales, Sparkle, TrendUp, Wrench } from '@phosphor-icons/react'

export const STATUS_META = {
  pass: { label: 'Pass', chip: 'bg-[var(--ok-bg)] text-[var(--ok)]', bar: 'bg-[var(--ok)]' },
  caution: { label: 'Caution', chip: 'bg-[var(--warn-bg)] text-[var(--warn)]', bar: 'bg-[var(--warn)]' },
  fail: { label: 'Fail', chip: 'bg-[var(--bad-bg)] text-[var(--bad)]', bar: 'bg-[var(--bad)]' },
  manual: { label: 'Review', chip: 'bg-[var(--ink)]/[.06] text-[var(--muted)]', bar: 'bg-[var(--muted)]/35' },
}

export const CATEGORY_ICONS = {
  Branding: Sparkle,
  'Trademark & Legal': Scales,
  SEO: MagnifyingGlass,
  Marketing: Megaphone,
  'Business Growth': TrendUp,
  Technical: Wrench,
  'Length & Quality': Ruler,
  International: GlobeHemisphereWest,
  Commercial: CurrencyDollar,
}
