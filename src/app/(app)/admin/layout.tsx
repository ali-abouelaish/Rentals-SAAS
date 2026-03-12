import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { AdminSectionNav } from "@/features/admin/ui/AdminSectionNav";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="space-y-5">
      <AdminSectionNav />
      {children}
    </div>
  );
}

