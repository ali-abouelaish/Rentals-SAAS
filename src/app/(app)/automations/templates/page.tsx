import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import {
  ensureDefaultTemplates,
  listTemplates,
} from "@/features/automations/data/templates";
import { TemplatesManager } from "@/features/automations/ui/TemplatesManager";

export default async function MessageTemplatesPage() {
  const profile = await requireRole([...ADMIN_ROLES]);
  await requireFeature("automations");
  await ensureDefaultTemplates(profile.tenant_id);

  const templates = await listTemplates(profile.tenant_id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Message templates
        </h1>
        <p className="text-xs text-foreground-secondary">
          The texts automation rules and reminders send. Placeholders like{" "}
          {"{{renter_name}}"} fill in per recipient. Yours to edit — changes only affect
          this agency.
        </p>
      </div>
      <TemplatesManager templates={templates} />
    </div>
  );
}
