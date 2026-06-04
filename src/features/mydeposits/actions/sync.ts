"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getMdContext } from "@/lib/mydeposits/apiClient";
import { pollOneProtection } from "../lib/pollProtection";
import type { MdProtection } from "../domain/types";

export async function syncProtection(id: string): Promise<{ ok: boolean; result: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const ctx = await getMdContext(profile.tenant_id);

  const { data: row, error } = await ctx.admin
    .from("mydeposits_protections")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (error || !row) throw new Error("Protection not found.");

  const result = await pollOneProtection(ctx, row as MdProtection);

  await ctx.admin
    .from("mydeposits_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("tenant_id", profile.tenant_id);

  revalidatePath("/deposits");
  revalidatePath("/contracts");
  return { ok: result !== "error", result };
}
