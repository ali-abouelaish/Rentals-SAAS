import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRule, getRuleActivity } from "@/features/automations/data/rules";
import { listTemplates } from "@/features/automations/data/templates";
import { listStaffForAssignment } from "@/features/automations/actions/reminders";
import { londonToday } from "@/features/automations/lib/london";
import {
  diffRentReminderParity,
  RENT_PRESET_TO_REMINDER_TYPE,
  type RentParityDiff,
} from "@/features/automations/lib/parity";
import { RuleDetail } from "@/features/automations/ui/RuleDetail";

export default async function RuleDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireRole([...ADMIN_ROLES]);
  await requireFeature("automations");

  const [rule, activity, templates, staff] = await Promise.all([
    getRule(profile.tenant_id, params.id),
    getRuleActivity(profile.tenant_id, params.id),
    listTemplates(profile.tenant_id),
    listStaffForAssignment(),
  ]);
  if (!rule) notFound();

  // Rent presets during migration: compare today's evaluation with what the
  // legacy cron sent, so the cutover decision is backed by an empty diff.
  let parity: RentParityDiff | null = null;
  if (rule.preset_key && RENT_PRESET_TO_REMINDER_TYPE[rule.preset_key]) {
    const admin = createSupabaseAdminClient();
    parity = await diffRentReminderParity(admin, profile.tenant_id, londonToday()).catch(
      () => null
    );
  }

  return (
    <RuleDetail
      rule={rule}
      activity={activity}
      templates={templates}
      staff={staff}
      parity={parity}
    />
  );
}
