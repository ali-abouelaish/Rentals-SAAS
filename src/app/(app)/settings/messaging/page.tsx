import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenantMessaging } from "@/features/automations/lib/settings";
import { MessagingSettingsForm } from "@/features/automations/ui/MessagingSettingsForm";

export default async function MessagingSettingsPage() {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const tenant = await getTenantMessaging(admin, profile.tenant_id);
  const settings = tenant?.settings ?? { windowStart: 8, windowEnd: 20, dailyLimit: 200 };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Messaging</h1>
        <p className="text-xs text-foreground-secondary">
          Quiet hours and safety limits for automated reminders and scheduled messages.
          Applies to email and SMS; in-app reminders are unaffected.
        </p>
      </div>
      <MessagingSettingsForm initial={settings} />
    </div>
  );
}
