import { asArray, asText } from './safe'

/*
 * Who can open what (see "Feed Portal Permissions — Frontend Guide").
 * The CRM decides each user's permissions (role defaults + extra permissions; admins get everything).
 * The frontend only maps pages to permission names, and uses one helper, can(), for routes and the menu.
 */

/*
 * Page -> CRM permission name (one record per module in the Permissions module).
 * Names must match the CRM exactly; when a permission is renamed in the CRM, rename it here in the same release.
 * Detail pages share their list page's permission (/jobs/:id needs "Jobs").
 * Pages not listed here are open to every signed-in user (Profile, Preferences, Activity, Onboarding).
 * "API Playground" has no CRM permission yet: until an admin creates one, only admins see that page.
 */
export const PAGE_PERMISSIONS = {
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

// Pages for admins only; no permission opens them.
const ADMIN_PATHS = ['/admin']

// Order used to pick a user's home page: the first page they can open.
const HOME_ORDER = ['/jobs', '/tech-news', '/site-content', '/domain', '/video', '/seo', '/appscript', '/llm', '/wordpress', '/cloud', '/social', '/email-to-blog', '/api-playground', '/live-jobs']

const matches = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`)

/** Admins (isAdmin: the CRM user's "Is Administrator" field) see every module and the admin panel. Checked before permissions. */
export function isAdminUser(user) {
  return user?.isAdmin === true
}

/** The user's role name, or null. /api/auth/me sends it as a string. */
export function roleOf(user) {
  const role = user?.role
  const name = typeof role === 'object' && role ? role.name : role
  return asText(name).trim() || null
}

/** What to show where the user's name appears. */
export const roleLabel = (user) => (isAdminUser(user) ? 'Admin' : roleOf(user) ?? 'No role')

/** True when the user holds this permission name. No permission needed, or an admin: always true. */
export function can(user, permission) {
  if (!permission || isAdminUser(user)) return true
  return asArray(user?.permissions).includes(permission)
}

/** The permission a page needs, or null when every signed-in user may open it. */
export function permissionForPath(pathname) {
  return Object.entries(PAGE_PERMISSIONS).find(([path]) => matches(pathname, path))?.[1] || null
}

export const isAdminPath = (pathname) => ADMIN_PATHS.some((path) => matches(pathname, path))

/**
 * True when a signed-in, non-admin user has no role yet and must pick one on the onboarding page.
 * Only once the CRM confirmed it (`accessChecked`), so an unreachable CRM never sends anyone to onboarding.
 */
export function needsRole(user) {
  return Boolean(user?.accessChecked) && !isAdminUser(user) && !roleOf(user)
}

/** Whether the user may open this page: onboarding first, admin pages for admins, otherwise the page's permission. */
export function canAccess(user, pathname) {
  if (needsRole(user)) return false
  if (isAdminPath(pathname)) return isAdminUser(user)
  return can(user, permissionForPath(pathname))
}

/** Where the user lands: onboarding, else the first page they can open, else Profile (open to everyone). */
export function homePath(user) {
  if (needsRole(user)) return '/onboarding'
  return HOME_ORDER.find((path) => canAccess(user, path)) || '/profile'
}

/**
 * A notice for the top of the app, or null:
 * 'unavailable' when the CRM could not be reached (only the open pages work), 'none' when the user has no modules yet.
 */
export function accessNotice(user) {
  if (!user || isAdminUser(user)) return null
  if (user.accessChecked === false) return 'unavailable'
  if (!needsRole(user) && !HOME_ORDER.some((path) => can(user, PAGE_PERMISSIONS[path]))) return 'none'
  return null
}
