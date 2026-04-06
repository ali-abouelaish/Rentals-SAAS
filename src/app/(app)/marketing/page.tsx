import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";

export default async function MarketingPage() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 mb-5">
        <Megaphone className="h-8 w-8 text-brand" />
      </div>
      <h1 className="text-2xl font-bold text-foreground tracking-tight">Marketing</h1>
      <p className="text-sm text-foreground-secondary mt-2 max-w-sm">
        Advertise vacant units, manage listings, and track enquiries. Coming soon.
      </p>
    </div>
  );
}
