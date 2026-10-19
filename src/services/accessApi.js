import { createAppError, fetchRoles, smartGateway, USERS_MODULE, ROLES_MODULE } from './api'
import { asArray, asText } from '../lib/safe'

/*
 * Access data read from the CRM through the smart gateway:
 * permissions (Permissions module), role defaults (Roles -> Permissions) and extra permissions (Users -> Permissions).
 * Used for the signed-in user until /api/auth/me sends `permissions`, and by the admin panel until /api/admin/* is live.
 */

export const PERMISSIONS_MODULE = import.meta.env?.VITE_PERMISSIONS_MODULE || 'outr_permissions'

const liveRecords = (records) => asArray(records).filter((record) => record?.id && record.deleted !== '1')
const isTrue = (value) => value === true || /^(1|true|yes)$/i.test(asText(value).trim())

/** Every permission, A-Z, as { id, name, description }. */
export async function fetchPermissionCatalog() {
  const data = await smartGateway({ action: 'fetch', module: PERMISSIONS_MODULE, order_by: 'name', order_dir: 'ASC', page: 1, per_page: 200 })
  return liveRecords(data.records)
    .map((record) => ({ id: record.id, name: asText(record.name).trim(), description: asText(record.description).trim() }))
    .filter((permission) => permission.name)
}

/** The permissions linked to a role or a user, as { id, name }. */
export async function fetchLinkedPermissions(module, id) {
  if (!id) return []
  const data = await smartGateway({ action: 'fetch_related', module, id, related_module: PERMISSIONS_MODULE, page: 1, per_page: 200 })
  return liveRecords(data.records).map((record) => ({ id: record.id, name: asText(record.name).trim() }))
}

/** A CRM user record, or a 404-style error. */
export async function fetchUserRecord(userId) {
  if (!userId) throw createAppError('USER_MISSING', 'No user was given.', { status: 400 })
  const data = await smartGateway({ action: 'fetch', module: USERS_MODULE, filters: { id: userId }, page: 1, per_page: 1 })
  const record = liveRecords(data.records).find((item) => item.id === userId)
  if (!record) throw createAppError('NOT_FOUND', 'That user could not be found.', { status: 404 })
  return record
}

export const userRoleId = (record) => asText(record?.aclrole_id_c).trim()
export const userIsAdmin = (record) => isTrue(record?.is_admin)
export const userDisplayName = (record) => asText([record?.first_name, record?.last_name].filter(Boolean).join(' ')).trim() || asText(record?.user_name).trim() || asText(record?.email1).trim() || 'Unnamed user'

/**
 * The signed-in user's access, the way the backend will work it out:
 * admin -> every permission; otherwise role defaults + the user's own (extra) permissions.
 * A role id that no longer exists counts as no role.
 */
export async function fetchUserAccess(crmUserId) {
  const record = await fetchUserRecord(crmUserId)
  const roleId = userRoleId(record)
  const [roles, roleDefaults, ownPermissions] = await Promise.all([
    roleId ? fetchRoles() : Promise.resolve([]),
    fetchLinkedPermissions(ROLES_MODULE, roleId),
    fetchLinkedPermissions(USERS_MODULE, crmUserId),
  ])
  const role = roles.find((item) => item.id === roleId) || null
  const isAdmin = userIsAdmin(record)
  const permissions = isAdmin
    ? (await fetchPermissionCatalog()).map((permission) => permission.name)
    : [...new Set([...(role ? roleDefaults : []), ...ownPermissions].map((permission) => permission.name))]
  return { role, isAdmin, permissions }
}
