import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countPendingForPmTenant } from "@/features/inbox/data/queries";

const REMINDER_LABELS: Record<string, string> = {
  upcoming_3d: "Upcoming (3 days)",
  due_today:   "Due today",
  // Legacy historical types
  upcoming_5d: "Upcoming (5 days)",
  overdue_3d:  "Overdue 3 days",
  overdue_7d:  "Overdue 7 days",
  overdue_14d: "Overdue 14 days",
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type Params = { id: string };

export default async function TenantRemindersPage({ params }: { params: Params }) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: tenant, error: tenantErr } = await supabase
    .from("pm_tenants")
    .select("id, full_name, email")
    .eq("id", params.id)
    .maybeSingle();
  if (tenantErr) throw new Error(tenantErr.message);
  if (!tenant) notFound();

  const { data: rows, error } = await supabase
    .from("rent_reminder_log")
    .select("id, reminder_type, period_start, sent_at, status, error_message")
    .eq("pm_tenant_id", params.id)
    .order("sent_at", { ascending: false });
  if (error) throw new Error(error.message);

  const reminders = rows ?? [];
  const pendingRequests = await countPendingForPmTenant(params.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Rent reminders"
          subtitle={`Email history for ${tenant.full_name}`}
        />
        {pendingRequests > 0 && (
          <Link href="/inbox?status=pending" className="shrink-0">
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
              {pendingRequests} pending request{pendingRequests === 1 ? "" : "s"}
            </Badge>
          </Link>
        )}
      </div>

      {reminders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Mail className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No reminders sent yet</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            Once the daily cron sends a rent reminder for this tenant, it will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-inset text-xs uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Sent at</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Rent period</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 text-foreground">{DATE_FMT.format(new Date(r.sent_at))}</td>
                  <td className="px-4 py-3 text-foreground">{REMINDER_LABELS[r.reminder_type] ?? r.reminder_type}</td>
                  <td className="px-4 py-3 text-foreground-secondary">{r.period_start}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.status === "sent"
                          ? "inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
                          : "inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-muted max-w-xs truncate">{r.error_message ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
