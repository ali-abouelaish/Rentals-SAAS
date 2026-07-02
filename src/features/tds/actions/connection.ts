"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { encryptTdsSecret, decryptTdsSecret } from "@/lib/tds/encrypt";
import { verifyTdsCredentials } from "@/lib/tds/apiClient";
import type {
  TdsEnvironment,
  TdsRegion,
  TdsSchemeType,
} from "@/lib/tds/config";

const ADMIN_PATH = "/admin/deposit-schemes";

const ENVIRONMENTS: TdsEnvironment[] = ["sandbox", "production"];
const REGIONS: TdsRegion[] = ["EW", "NI"];
const SCHEME_TYPES: TdsSchemeType[] = ["Custodial", "Insured"];

type ActionResult = { ok: boolean; error?: string };

async function logTdsAction(
  actorUserId: string,
  tenantId: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  const admin = createSupabaseAdminClient();
  await admin.from("activity_log").insert({
    tenant_id: tenantId,
    actor_user_id: actorUserId,
    action,
    entity_type: "tds_connection",
    entity_id: tenantId,
    metadata: metadata ?? null,
  });
}

export async function saveTdsConnectionAction(input: {
  tenantId: string;
  environment: string;
  memberId: string;
  branchId: string;
  apiKey: string;
  region: string;
  schemeType: string;
  accountLabel?: string;
}): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const tenantId = input.tenantId?.trim();
  const memberId = input.memberId?.trim();
  const branchId = (input.branchId?.trim() || "0");
  const environment = input.environment?.trim() as TdsEnvironment;
  const region = input.region?.trim() as TdsRegion;
  const schemeType = input.schemeType?.trim() as TdsSchemeType;
  const accountLabel = input.accountLabel?.trim() || null;
  const apiKeyInput = input.apiKey?.trim() ?? "";

  if (!tenantId) return { ok: false, error: "Tenant is required." };
  if (!memberId) return { ok: false, error: "Member ID is required." };
  if (!ENVIRONMENTS.includes(environment)) return { ok: false, error: "Invalid environment." };
  if (!REGIONS.includes(region)) return { ok: false, error: "Invalid region." };
  if (!SCHEME_TYPES.includes(schemeType)) return { ok: false, error: "Invalid scheme type." };

  // Look up an existing connection so an edit can keep the stored key when the
  // api_key field is left blank.
  const { data: existing } = await admin
    .from("tds_connections")
    .select("api_key")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let apiKey = apiKeyInput;
  if (!apiKey) {
    if (!existing?.api_key) {
      return { ok: false, error: "API key is required." };
    }
    try {
      apiKey = decryptTdsSecret(existing.api_key as string);
    } catch {
      return { ok: false, error: "Could not read the stored API key. Re-enter it." };
    }
  }

  // Verify before storing — bad keys are rejected, never persisted.
  const verify = await verifyTdsCredentials({ environment, memberId, branchId, apiKey });
  if (!verify.ok) {
    return { ok: false, error: verify.error ?? "TDS could not verify these credentials." };
  }

  const { error } = await admin.from("tds_connections").upsert(
    {
      tenant_id: tenantId,
      environment,
      member_id: memberId,
      branch_id: branchId,
      api_key: encryptTdsSecret(apiKey),
      region,
      scheme_type: schemeType,
      account_label: accountLabel,
      connected_by: actor.id,
      last_verified_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "tenant_id" }
  );
  if (error) return { ok: false, error: error.message };

  await logTdsAction(actor.id, tenantId, "admin_tds_connection_saved", {
    environment,
    member_id: memberId,
    branch_id: branchId,
    region,
    scheme_type: schemeType,
    key_rotated: Boolean(apiKeyInput),
  });

  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

export async function verifyTdsConnectionAction(input: {
  tenantId: string;
}): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: conn, error } = await admin
    .from("tds_connections")
    .select("environment, member_id, branch_id, api_key")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!conn) return { ok: false, error: "No TDS connection for this agency." };

  let apiKey: string;
  try {
    apiKey = decryptTdsSecret(conn.api_key as string);
  } catch {
    return { ok: false, error: "Could not read the stored API key. Re-enter it." };
  }

  const result = await verifyTdsCredentials({
    environment: conn.environment as TdsEnvironment,
    memberId: conn.member_id as string,
    branchId: conn.branch_id as string,
    apiKey,
  });

  await admin
    .from("tds_connections")
    .update({
      last_verified_at: result.ok ? new Date().toISOString() : null,
      last_error: result.ok ? null : result.error ?? "Verification failed.",
    })
    .eq("tenant_id", input.tenantId);

  await logTdsAction(actor.id, input.tenantId, "admin_tds_connection_verified", {
    ok: result.ok,
  });

  revalidatePath(ADMIN_PATH);
  return result;
}

export async function deleteTdsConnectionAction(input: {
  tenantId: string;
}): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("tds_connections")
    .delete()
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logTdsAction(actor.id, input.tenantId, "admin_tds_connection_deleted");

  revalidatePath(ADMIN_PATH);
  return { ok: true };
}
