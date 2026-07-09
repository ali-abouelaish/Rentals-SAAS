"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { encryptDpsSecret, decryptDpsSecret } from "@/lib/dps/encrypt";
import { verifyDpsCredentials } from "@/lib/dps/apiClient";
import type { DpsEnvironment } from "@/lib/dps/config";

const ADMIN_PATH = "/admin/deposit-schemes";

const ENVIRONMENTS: DpsEnvironment[] = ["uat", "production"];

type ActionResult = { ok: boolean; error?: string };

async function logDpsAction(
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
    entity_type: "dps_connection",
    entity_id: tenantId,
    metadata: metadata ?? null,
  });
}

export async function saveDpsConnectionAction(input: {
  tenantId: string;
  environment: string;
  agentLandlordId: string;
  clientId: string;
  clientSecret: string;
  accountLabel?: string;
}): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const tenantId = input.tenantId?.trim();
  const environment = input.environment?.trim() as DpsEnvironment;
  const agentLandlordId = input.agentLandlordId?.trim();
  const clientId = input.clientId?.trim();
  const accountLabel = input.accountLabel?.trim() || null;
  const clientSecretInput = input.clientSecret?.trim() ?? "";

  if (!tenantId) return { ok: false, error: "Tenant is required." };
  if (!ENVIRONMENTS.includes(environment)) return { ok: false, error: "Invalid environment." };
  if (!/^\d{7}$/.test(agentLandlordId ?? "")) {
    return { ok: false, error: "Agent/Landlord ID must be exactly 7 digits." };
  }
  if (!clientId) return { ok: false, error: "Client ID is required." };

  // Look up an existing connection so an edit can keep the stored secret when
  // the client_secret field is left blank.
  const { data: existing } = await admin
    .from("dps_connections")
    .select("client_secret")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let clientSecret = clientSecretInput;
  if (!clientSecret) {
    if (!existing?.client_secret) {
      return { ok: false, error: "Client secret is required." };
    }
    try {
      clientSecret = decryptDpsSecret(existing.client_secret as string);
    } catch {
      return { ok: false, error: "Could not read the stored client secret. Re-enter it." };
    }
  }

  // Verify before storing — bad keys are rejected, never persisted. (Token
  // acquisition validates client ID + secret; the Agent/Landlord ID is only
  // exercised on the first tenancy creation.)
  const verify = await verifyDpsCredentials(tenantId, { environment, clientId, clientSecret });
  if (!verify.ok) {
    return { ok: false, error: verify.error ?? "DPS could not verify these credentials." };
  }

  const { error } = await admin.from("dps_connections").upsert(
    {
      tenant_id: tenantId,
      environment,
      agent_landlord_id: agentLandlordId,
      client_id: clientId,
      client_secret: encryptDpsSecret(clientSecret),
      account_label: accountLabel,
      connected_by: actor.id,
      last_verified_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "tenant_id" }
  );
  if (error) return { ok: false, error: error.message };

  await logDpsAction(actor.id, tenantId, "admin_dps_connection_saved", {
    environment,
    agent_landlord_id: agentLandlordId,
    client_id: clientId,
    secret_rotated: Boolean(clientSecretInput),
  });

  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

export async function verifyDpsConnectionAction(input: {
  tenantId: string;
}): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: conn, error } = await admin
    .from("dps_connections")
    .select("environment, client_id, client_secret")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!conn) return { ok: false, error: "No DPS connection for this agency." };

  let clientSecret: string;
  try {
    clientSecret = decryptDpsSecret(conn.client_secret as string);
  } catch {
    return { ok: false, error: "Could not read the stored client secret. Re-enter it." };
  }

  const result = await verifyDpsCredentials(input.tenantId, {
    environment: conn.environment as DpsEnvironment,
    clientId: conn.client_id as string,
    clientSecret,
  });

  await admin
    .from("dps_connections")
    .update({
      last_verified_at: result.ok ? new Date().toISOString() : null,
      last_error: result.ok ? null : result.error ?? "Verification failed.",
    })
    .eq("tenant_id", input.tenantId);

  await logDpsAction(actor.id, input.tenantId, "admin_dps_connection_verified", {
    ok: result.ok,
  });

  revalidatePath(ADMIN_PATH);
  return result;
}

export async function deleteDpsConnectionAction(input: {
  tenantId: string;
}): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("dps_connections")
    .delete()
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logDpsAction(actor.id, input.tenantId, "admin_dps_connection_deleted");

  revalidatePath(ADMIN_PATH);
  return { ok: true };
}
