import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MessagingSettings } from "../domain/types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type TenantMessaging = {
  name: string;
  settings: MessagingSettings;
};

/** Agency name + send-window/rate-limit settings, one tenants read. */
export async function getTenantMessaging(
  admin: Admin,
  tenantId: string
): Promise<TenantMessaging | null> {
  const { data, error } = await admin
    .from("tenants")
    .select("name, msg_send_window_start, msg_send_window_end, msg_daily_limit")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    name: (data.name as string) ?? "",
    settings: {
      windowStart: Number(data.msg_send_window_start ?? 8),
      windowEnd: Number(data.msg_send_window_end ?? 20),
      dailyLimit: Number(data.msg_daily_limit ?? 200),
    },
  };
}
