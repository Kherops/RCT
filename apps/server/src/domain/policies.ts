import { Role, PermissionAction } from './types.js';

const rolePermissions: Record<Role, PermissionAction[]> = {
  OWNER: [
    'channel:create',
    'channel:update',
    'channel:delete',
    'message:delete_others',
    'member:update_role',
    'server:update',
    'server:delete',
    'invite:create',
    'ownership:transfer',
  ],
  ADMIN: [
    'channel:create',
    'channel:update',
    'channel:delete',
    'message:delete_others',
    'invite:create',
  ],
  MEMBER: [],
};

export function hasPermission(role: Role, action: PermissionAction): boolean {
  return rolePermissions[role].includes(action);
}

export function canManageRole(managerRole: Role, targetRole: Role): boolean {
  if (managerRole !== 'OWNER') return false;
  return targetRole !== 'OWNER';
}

export function getRoleHierarchy(role: Role): number {
  const hierarchy: Record<Role, number> = {
    OWNER: 3,
    ADMIN: 2,
    MEMBER: 1,
  };
  return hierarchy[role];
}

export function isRoleHigherOrEqual(role1: Role, role2: Role): boolean {
  return getRoleHierarchy(role1) >= getRoleHierarchy(role2);
}
