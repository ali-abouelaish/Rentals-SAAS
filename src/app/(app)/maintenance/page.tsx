import { Wrench } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getAllMaintenanceJobs } from "@/features/maintenance/data/queries";
import { getAllMaintenanceTickets } from "@/features/maintenance/data/tickets";
import { getAllSuppliers } from "@/features/maintenance/data/suppliers";
import { MaintenancePage } from "@/features/maintenance/ui/MaintenancePage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface Props {
  searchParams: { job?: string; ticket?: string; supplier?: string };
}

export default async function MaintenanceRoute({ searchParams }: Props) {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  try {
    const [jobs, tickets, suppliers, propertiesResult] = await Promise.all([
      getAllMaintenanceJobs(),
      getAllMaintenanceTickets(),
      getAllSuppliers(),
      (async () => {
        try {
          const supabase = createSupabaseServerClient();
          const { data } = await supabase.from("properties").select("id, name").order("name");
          return data ?? [];
        } catch {
          return [];
        }
      })(),
    ]);

    return (
      <MaintenancePage
        jobs={jobs}
        tickets={tickets}
        suppliers={suppliers}
        properties={propertiesResult}
        initialJobId={searchParams.job}
        initialTicketId={searchParams.ticket}
        initialSupplierId={searchParams.supplier}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Maintenance</h1>
        </div>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Wrench className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">Failed to load maintenance data</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">{message}</p>
        </div>
      </div>
    );
  }
}
