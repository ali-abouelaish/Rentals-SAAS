import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth/requireRole";

/**
 * The single gate for the whole /admin tree.
 *
 * Section navigation lives in the sidebar (ADMIN_NAV_GROUPS in
 * src/components/layout/navConfig.tsx), not in a tab bar here — so this layout
 * only enforces access. Every data function and action under /admin re-checks
 * `requireSuperAdmin()` on its own, so removing this would not open the door, but
 * it is what stops an unauthorised request rendering a page shell at all.
 */
export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin();

  return <div className="space-y-5">{children}</div>;
}

