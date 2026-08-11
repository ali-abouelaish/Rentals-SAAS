import Link from "next/link";
import { FileText } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { listRules } from "@/features/automations/data/rules";
import { ensureDefaultTemplates } from "@/features/automations/data/templates";
import { Button } from "@/components/ui/button";
import { RulesList } from "@/features/automations/ui/RulesList";
import { PresetLibrary } from "@/features/automations/ui/PresetLibrary";
import { ConnectMailboxNotice } from "@/features/email-providers/ui/ConnectMailboxNotice";

export default async function AutomationsPage() {
  const profile = await requireRole([...ADMIN_ROLES]);
  await requireFeature("automations");
  await ensureDefaultTemplates(profile.tenant_id);

  const rules = await listRules(profile.tenant_id);
  const existingPresetKeys = rules
    .map((r) => r.preset_key)
    .filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Automations</h1>
          <p className="text-xs text-foreground-secondary">
            Rules that schedule reminders for you — rent due, arrears chasing, expiry
            warnings, works-order chasing. Everything they queue shows up under Reminders
            before it sends.
          </p>
        </div>
        <Link href="/automations/templates">
          <Button variant="outline" size="sm" title="Edit the message texts rules send">
            <FileText className="h-3.5 w-3.5" />
            Templates
          </Button>
        </Link>
      </div>

      <ConnectMailboxNotice tenantId={profile.tenant_id} />

      <RulesList rules={rules} />

      <PresetLibrary existingPresetKeys={existingPresetKeys} />
    </div>
  );
}
