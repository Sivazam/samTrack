import { Role } from '@/types';

export function isAdminOrManager(role?: Role | null): boolean {
  return role === 'COLLEGE_ADMIN' || role === 'MANAGER' || role === 'SUPER_ADMIN';
}

export function isPRO(role?: Role | null): boolean {
  return role === 'PRO';
}

export function isSuperAdmin(role?: Role | null): boolean {
  return role === 'SUPER_ADMIN';
}

export function isTenantScopedRole(role?: Role | null): boolean {
  return role === 'COLLEGE_ADMIN' || role === 'MANAGER' || role === 'PRO';
}

export function getRoleLabel(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN': return 'Super Admin';
    case 'COLLEGE_ADMIN': return 'College Admin';
    case 'MANAGER': return 'Manager';
    case 'PRO': return 'PRO';
    default: return role;
  }
}
