import { Wrench } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

export default async function MaintenancePage() {
  await requireRole([...ADMIN_ROLES]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 mb-5">
        <Wrench className="h-8 w-8 text-brand" />
      </div>
      <h1 className="text-2xl font-bold text-foreground tracking-tight">Maintenance</h1>
      <p className="text-sm text-foreground-secondary mt-2 max-w-sm">
        Log and track maintenance requests, assign contractors, and manage repairs. Coming soon.
      </p>
    </div>
  );
}
