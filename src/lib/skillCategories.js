// Skill categories and their subcategories, as shown in the job filter.
export const SKILL_TAXONOMY = {
  Development: ['Backend', 'Frontend', 'Database'],
  'Digital Marketing': ['SEO', 'Content', 'UI/UX'],
}

export const UNCATEGORIZED = 'Uncategorized'

const CATEGORY_OF = Object.fromEntries(Object.entries(SKILL_TAXONOMY).flatMap(([category, subs]) => subs.map((sub) => [sub, category])))

// CRM skills have no subcategory yet, so it is guessed from the skill name.
// Checked in order: the first matching rule wins, so specific rules come before broad ones
// ("email parser" is Backend, "email automation" is Content, "mysql backup" is Database).
const RULES = [
  ['Database', /\b(my)?sql\b|database|postgres|mongo|redis|sqlite|oracle|mariadb|backup|data migration/],
  ['UI/UX', /\bui\b|\bux\b|figma|wireframe|prototyp|user experience|user interface|\bdesign/],
  ['SEO', /\bseo\b|search engine|backlink|keyword|\bserp\b|ranking|analytics/],
  ['Backend', /pars(er|ing)|\bapis?\b|integration|webhook|server|php|node|python|laravel|django|\bjava\b|\.net|ruby|golang|crm|\bmcp\b|model context|twilio|a2p|docusign|graph|azure/],
  ['Content', /content|copywrit|blog|article|writing|e-?mail|drip|newsletter|social media|video|marketing/],
  ['Frontend', /html|css|javascript|\bjs\b|react|vue|angular|next\.?js|tailwind|front.?end|jquery|bootstrap|wordpress|woocommerce|shopify|webflow|theme/],
  ['Backend', /develop|automation|software|plugin|365|office|gmail|google|microsoft|trello|back.?end/],
]

function guessSubcategory(name) {
  const text = String(name || '').toLowerCase()
  return RULES.find(([, pattern]) => pattern.test(text))?.[0] || ''
}

// { category, subcategory } for a skill record. A category set in the CRM wins; the subcategory
// (and the category, when the CRM has none) comes from the skill name.
export function classifySkill(record) {
  const guessed = asSubcategory(record?.subcategory) || guessSubcategory(record?.name)
  const category = record?.category || CATEGORY_OF[guessed] || UNCATEGORIZED
  const subcategory = CATEGORY_OF[guessed] === category ? guessed : ''
  return { category, subcategory }
}

function asSubcategory(value) {
  const text = String(value || '').trim().toLowerCase()
  return Object.keys(CATEGORY_OF).find((sub) => sub.toLowerCase() === text) || ''
}
