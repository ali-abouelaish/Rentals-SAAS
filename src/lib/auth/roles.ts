/**
 * Role names used for nav visibility and route protection.
 * Use these when checking allowedRoles or requireRole so admin and super_admin both get access where intended.
 */
export const ADMIN_ROLES = ["admin", "super_admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role.toLowerCase() as AdminRole);
}

export function canAccessRoute(userRole: string | null | undefined, allowedRoles: readonly string[]): boolean {
  if (!allowedRoles.length) return true;
  if (!userRole) return false;
  const r = userRole.toLowerCase();
  return allowedRoles.some((a) => a.toLowerCase() === r);
}
