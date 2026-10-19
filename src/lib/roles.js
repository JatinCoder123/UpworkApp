import { asArray, asText } from './safe'

/*
 * Which menu sections each CRM role (ACL role) sees. Handled in the frontend for now; it will move to
 * an endpoint later. Keys are role names in lower case; ALL gives every section.
 * PLACEHOLDER mapping: adjust the lists once each team's sections are agreed.
 * A role that is not listed here (for example one added in the CRM later) also gets every section,
 * so a new role never locks anyone out.
 */
const ALL = '*'
export const ROLE_SECTIONS = {
  developer: ['/jobs', '/live-jobs', '/wordpress', '/appscript', '/llm', '/cloud', '/api-playground'],
  qa: ['/jobs', '/live-jobs', '/api-playground', '/appscript'],
  seo: ['/seo', '/site-content', '/tech-news', '/domain'],
  content: ['/site-content', '/tech-news', '/email-to-blog', '/social', '/video'],
  design: ['/site-content', '/video', '/social', '/wordpress'],
  'ai manager': ['/tech-news', '/llm', '/jobs', '/site-content'],
  manager: ALL,
  admin: ALL,
}

// Roles nobody can pick for themselves on the onboarding page.
export const HIDDEN_ROLES = ['admin']

// Section names, for the onboarding preview.
export const SECTION_LABELS = {
  '/jobs': 'Jobs',
  '/live-jobs': 'Live Jobs',
  '/tech-news': 'AI News',
  '/site-content': 'Site Content',
  '/domain': 'Domain',
  '/video': 'Video',
  '/seo': 'SEO',
  '/appscript': 'AppScript',
  '/llm': 'LLM',
  '/wordpress': 'Wordpress',
  '/cloud': 'Cloud',
  '/social': 'Social',
  '/email-to-blog': 'Email to Blog',
  '/api-playground': 'API Playground',
}

// Pages every signed-in user can open, whatever their role.
const ALWAYS_ALLOWED = ['/profile', '/preferences', '/activity', '/404']
const DEFAULT_HOME = '/jobs'

const matches = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`)

/**
 * The user's role names. Accepts what /api/auth/me may send in `roles` or `role`:
 * a name, a list of names, or a list of { name } objects.
 */
export function rolesOf(user) {
  const value = user?.roles ?? user?.role
  const list = Array.isArray(value) ? value : value ? [value] : []
  return [...new Set(asArray(list)
    .map((role) => asText(typeof role === 'object' && role ? role.name ?? role.role_name ?? role.label : role).trim())
    .filter(Boolean))]
}

/** The sections a role sees: a list of paths, or ALL. */
export function sectionsForRole(name) {
  return ROLE_SECTIONS[asText(name).trim().toLowerCase()] ?? ALL
}

/**
 * Admins see every section. True when the CRM user is an administrator,
 * or /api/auth/me says so (userType "admin" today; a boolean later).
 */
export function isAdminUser(user) {
  const type = user?.userType ?? user?.user_type
  return user?.isAdmin === true || type === true || /^admin/i.test(asText(type).trim())
}

/**
 * True when a signed-in, non-admin user's role is still empty, so they must pick one on the onboarding page.
 * Admins never need a role: they skip onboarding and see every section.
 */
export function needsRole(user) {
  return Boolean(user?.rolesChecked) && !isAdminUser(user) && rolesOf(user).length === 0
}

// null means every section; otherwise the paths from all of the user's roles combined.
function allowedPaths(user) {
  if (!user?.rolesChecked || isAdminUser(user)) return null
  const sections = rolesOf(user).map(sectionsForRole)
  if (sections.some((paths) => paths === ALL)) return null
  return [...new Set(sections.flat())]
}

export function canAccess(user, pathname) {
  if (needsRole(user)) return false
  const paths = allowedPaths(user)
  return !paths || [...ALWAYS_ALLOWED, ...paths].some((path) => matches(pathname, path))
}

/** Where the user lands after login, and where a page outside their role sends them. */
export function homePath(user) {
  if (needsRole(user)) return '/onboarding'
  const paths = allowedPaths(user)
  if (!paths) return DEFAULT_HOME
  // A role with no sections still has somewhere to land that it is allowed to open.
  if (!paths.length) return '/profile'
  return Object.keys(SECTION_LABELS).find((path) => paths.includes(path)) || paths[0]
}
