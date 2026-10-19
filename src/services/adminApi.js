import { createAppError, fetchRoles, smartGateway, USERS_MODULE, ROLES_MODULE } from './api'
import { PERMISSIONS_MODULE, fetchLinkedPermissions, fetchPermissionCatalog, fetchUserRecord, userDisplayName, userIsAdmin, userRoleId } from './accessApi'
import { asArray, asText } from '../lib/safe'

/*
 * Admin panel data, read and saved in the CRM through the smart gateway.
 * Responses keep the shapes of the agreed contract ("Feed Portal Permissions — Frontend Guide"):
 *   permissions: [{ id, name, description }]   roles: [{ id, name, permissionIds }]
 *   users: [{ id, name, email, role, isAdmin }]
 *   access: { user, isAdmin, role, fromRole, extra, effective }
 * Only admins can open the panel (route + menu check isAdmin); the gateway itself does not check who is calling.
 */

// ----------------------------------------------------------------------------
// CRM implementations
// ----------------------------------------------------------------------------

const link = (action, module, id, relatedId) => smartGateway({ action, module, id, related_module: PERMISSIONS_MODULE, related_id: relatedId })

async function gatewayRoles() {
  const roles = await fetchRoles()
  const linked = await Promise.all(roles.map((role) => fetchLinkedPermissions(ROLES_MODULE, role.id)))
  return roles.map((role, index) => ({ id: role.id, name: role.name, permissionIds: linked[index].map((permission) => permission.id) }))
}

async function gatewayUsers() {
  const perPage = 100
  const first = await smartGateway({ action: 'fetch', module: USERS_MODULE, order_by: 'first_name', order_dir: 'ASC', page: 1, per_page: perPage })
  const totalPages = Math.max(1, Number(first.total_pages) || 1)
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => smartGateway({ action: 'fetch', module: USERS_MODULE, order_by: 'first_name', order_dir: 'ASC', page: index + 2, per_page: perPage })))
  const roles = await fetchRoles()
  return [first, ...rest]
    .flatMap((page) => asArray(page?.records))
    .filter((record) => record?.id && record.deleted !== '1')
    .map((record) => {
      const roleId = userRoleId(record)
      return {
        id: record.id,
        name: userDisplayName(record),
        email: asText(record.email1).trim(),
        role: roles.find((role) => role.id === roleId)?.name || null,
        isAdmin: userIsAdmin(record),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/*
 * The access object from the contract. Until the backend stops copying role defaults into each user's own list,
 * a user's list can hold copies of their role's permissions; those count as "from role", and only the rest are "extra".
 */
async function gatewayAccess(userId) {
  const record = await fetchUserRecord(userId)
  const roleId = userRoleId(record)
  const [roles, roleDefaults, ownPermissions, catalog] = await Promise.all([
    fetchRoles(),
    fetchLinkedPermissions(ROLES_MODULE, roleId),
    fetchLinkedPermissions(USERS_MODULE, userId),
    fetchPermissionCatalog(),
  ])
  const role = roles.find((item) => item.id === roleId) || null
  const fromRole = role ? roleDefaults.map((permission) => permission.id) : []
  const own = ownPermissions.map((permission) => permission.id)
  const extra = own.filter((id) => !fromRole.includes(id))
  const isAdmin = userIsAdmin(record)
  return {
    user: { id: record.id, name: userDisplayName(record), email: asText(record.email1).trim() },
    isAdmin,
    role: role ? { id: role.id, name: role.name } : null,
    fromRole,
    extra,
    effective: isAdmin ? catalog.map((permission) => permission.id) : [...new Set([...fromRole, ...extra])],
    // Gateway only: the user's own list, including copies of role defaults (used when the role changes).
    own,
  }
}

async function gatewaySetRole(userId, roleId) {
  const before = await gatewayAccess(userId)
  if (roleId) {
    const roles = await fetchRoles()
    if (!roles.some((role) => role.id === roleId)) throw createAppError('NOT_FOUND', 'That role no longer exists.', { status: 404 })
  }
  await smartGateway({ action: 'update', module: USERS_MODULE, id: userId, data: { aclrole_id_c: roleId || '' } })
  // Copies of the old role's defaults in the user's own list would otherwise turn into "extra" permissions.
  const staleCopies = before.own.filter((id) => before.fromRole.includes(id))
  await Promise.all(staleCopies.map((permissionId) => link('remove_relationship', USERS_MODULE, userId, permissionId)))
  const after = await gatewayAccess(userId)
  if ((after.role?.id || null) !== (roleId || null)) throw createAppError('NOT_SAVED', 'The role could not be saved. Please try again.', { status: 502 })
  return after
}

async function gatewaySetAdmin(userId, isAdmin) {
  await smartGateway({ action: 'update', module: USERS_MODULE, id: userId, data: { is_admin: isAdmin ? 1 : 0 } })
  const after = await gatewayAccess(userId)
  if (after.isAdmin !== Boolean(isAdmin)) throw createAppError('NOT_SAVED', 'The admin setting could not be saved. Please try again.', { status: 502 })
  return after
}

async function gatewayAddPermission(userId, permissionId) {
  const before = await gatewayAccess(userId)
  if (!before.own.includes(permissionId) && !before.fromRole.includes(permissionId)) await link('add_relationship', USERS_MODULE, userId, permissionId)
  return gatewayAccess(userId)
}

async function gatewayRemovePermission(userId, permissionId) {
  const before = await gatewayAccess(userId)
  if (before.fromRole.includes(permissionId)) throw createAppError('FROM_ROLE', 'This permission comes from the role. Change the role instead.', { status: 400 })
  if (before.own.includes(permissionId)) await link('remove_relationship', USERS_MODULE, userId, permissionId)
  return gatewayAccess(userId)
}

async function gatewaySetRolePermissions(roleId, permissionIds) {
  const roles = await fetchRoles()
  const role = roles.find((item) => item.id === roleId)
  if (!role) throw createAppError('NOT_FOUND', 'That role no longer exists.', { status: 404 })
  const wanted = new Set(asArray(permissionIds))
  const current = (await fetchLinkedPermissions(ROLES_MODULE, roleId)).map((permission) => permission.id)
  await Promise.all([
    ...[...wanted].filter((id) => !current.includes(id)).map((id) => link('add_relationship', ROLES_MODULE, roleId, id)),
    ...current.filter((id) => !wanted.has(id)).map((id) => link('remove_relationship', ROLES_MODULE, roleId, id)),
  ])
  const saved = (await fetchLinkedPermissions(ROLES_MODULE, roleId)).map((permission) => permission.id)
  return { role: { id: role.id, name: role.name, permissionIds: saved } }
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export const adminApi = {
  getPermissions: async () => ({ permissions: await fetchPermissionCatalog() }),
  getRoles: async () => ({ roles: await gatewayRoles() }),
  getUsers: async (search = '') => {
    const term = asText(search).trim().toLowerCase()
    const users = await gatewayUsers()
    return { users: term ? users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(term)) : users }
  },
  getUserAccess: async (userId) => ({ access: await gatewayAccess(userId) }),
  setUserRole: async (userId, roleId) => ({ access: await gatewaySetRole(userId, roleId) }),
  setUserAdmin: async (userId, isAdmin) => ({ access: await gatewaySetAdmin(userId, isAdmin) }),
  addUserPermission: async (userId, permissionId) => ({ access: await gatewayAddPermission(userId, permissionId) }),
  removeUserPermission: async (userId, permissionId) => ({ access: await gatewayRemovePermission(userId, permissionId) }),
  setRolePermissions: (roleId, permissionIds) => gatewaySetRolePermissions(roleId, permissionIds),
}
