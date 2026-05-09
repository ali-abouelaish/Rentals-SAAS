import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Thrown when an agency has no usable contact_email. Callers (e.g. the email
 * worker) detect this to mark sends as permanent failures rather than retrying.
 */
export class MissingContactEmailError extends Error {
  readonly tenantId: string;
  constructor(tenantId: string) {
    super(`Agency ${tenantId} has no contact_email; refusing to send`);
    this.name = "MissingContactEmailError";
    this.tenantId = tenantId;
  }
}

/**
 * Resolve the reply-to address for outbound mail on behalf of an agency.
 * Throws MissingContactEmailError if the agency has no usable contact_email —
 * silent fallbacks would cause replies to vanish.
 */
export async function loadAgencyContactEmail(tenantId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("contact_email")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load tenant ${tenantId}: ${error.message}`);
  const value = ((data?.contact_email as string | null) ?? "").trim();
  if (!value) {
    throw new MissingContactEmailError(tenantId);
  }
  return value;
}
