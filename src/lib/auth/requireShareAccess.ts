import { createSupabaseServerClient } from "../supabase/server";
import { requireRole } from "./requireRole";
import { ADMIN_ROLES } from "./roles";
import type { PropertyShare } from "@/features/property-shares/domain/types";

export class ShareAccessError extends Error {
  readonly code: "not_found" | "forbidden";
  constructor(code: "not_found" | "forbidden") {
    super(code);
    this.code = code;
    this.name = "ShareAccessError";
  }
}

export async function requireShareAccess(shareId: string): Promise<{
  profile: Awaited<ReturnType<typeof requireRole>>;
  share: PropertyShare;
}> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: share, error } = await supabase
    .from("property_shares")
    .select("*")
    .eq("id", shareId)
    .single();

  if (error || !share) throw new ShareAccessError("not_found");
  if (share.tenant_id !== profile.tenant_id) throw new ShareAccessError("forbidden");

  return { profile, share: share as PropertyShare };
}
