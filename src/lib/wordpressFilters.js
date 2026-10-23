// Filters of the WordPress feed's filter panel (see components/WordpressFilterDialog): each is a list of CRM dropdown
// keys ([] = all); priorities are 'high' / 'medium' / 'low' from the demand score.
export const EMPTY_WP_FILTERS = { categories: [], pricing: [], trends: [], sources: [], priorities: [] }

export const countWpFilters = (filters) => Object.values(filters).reduce((total, list) => total + list.length, 0)

export const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High priority', note: 'Demand score 80 or more', dot: 'bg-[var(--lime-dark)]' },
  { value: 'medium', label: 'Medium priority', note: 'Demand score 60 to 79', dot: 'bg-[#e0a526]' },
  { value: 'low', label: 'Low priority', note: 'Demand score under 60', dot: 'bg-[#e05a47]' },
]
