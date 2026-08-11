"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { messagingSettingsSchema, type MessagingSettings } from "../domain/types";
import { getTenantMessaging } from "../lib/settings";

export async function getMessagingSettings(): Promise<MessagingSettings> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const tenant = await getTenantMessaging(admin, profile.tenant_id);
  return tenant?.settings ?? { windowStart: 8, windowEnd: 20, dailyLimit: 200 };
}

export type UpdateMessagingSettingsResult = { ok: true } | { ok: false; error: string };

export async function updateMessagingSettings(
  input: MessagingSettings
): Promise<UpdateMessagingSettingsResult> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const parsed = messagingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenants")
    .update({
      msg_send_window_start: parsed.data.windowStart,
      msg_send_window_end: parsed.data.windowEnd,
      msg_daily_limit: parsed.data.dailyLimit,
    })
    .eq("id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/messaging");
  return { ok: true };
}
