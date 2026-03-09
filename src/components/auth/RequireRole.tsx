import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/requireRole";

/**
 * Server component: ensures the current user has one of the allowed roles.
 * Redirects to /dashboard if not. Use requireAgentOnly() in /me layout for agent-only + redirect to /earnings.
 */
export async function RequireRole({
  role,
  roles,
  children
}: {
  role?: string;
  roles?: string[];
  children: ReactNode;
}) {
  const allowed = roles ?? (role ? [role] : []);
  if (allowed.length === 0) return <>{children}</>;
  await requireRole(allowed);
  return <>{children}</>;
}
