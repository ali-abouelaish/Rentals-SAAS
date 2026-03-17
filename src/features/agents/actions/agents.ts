"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  agentUpdateSchema,
  agentCreateSchema,
  type AgentUpdateValues,
  type AgentCreateValues
} from "../domain/schemas";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getInviteRedirectBaseDomain(): string | null {
  const envDomain = process.env.APP_PORTAL_DOMAIN;
  if (envDomain) {
    return envDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;

  try {
    const host = new URL(appUrl).host;
    if (host.includes("localhost")) return null;
    return host;
  } catch {
    return null;
  }
}

export async function updateAgentCommission(userId: string, values: AgentUpdateValues) {
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const profile = await requireRole(["admin"]);
  const payload = agentUpdateSchema.parse(values);

  const isAgent =
    payload.role === "agent" || payload.role === "agent_and_marketing" || payload.role === "admin";
  const isMarketing =
    payload.role === "marketing_only" ||
    payload.role === "agent_and_marketing" ||
    payload.role === "admin";

  const { error: profileError } = await admin
    .from("user_profiles")
    .update({ role: payload.role })
    .eq("id", userId)
    .eq("tenant_id", profile.tenant_id);
  if (profileError) throw new Error(profileError.message);

  const { error } = await supabase
    .from("agent_profiles")
    .update({
      commission_percent: payload.commission_percent,
      marketing_fee: payload.marketing_fee,
      role_flags: { is_agent: isAgent, is_marketing: isMarketing }
    })
    .eq("user_id", userId)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/agents/${userId}`);
  revalidatePath("/earnings");
  return { ok: true };
}

export async function createAgent(
  values: AgentCreateValues
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const profile = await requireRole([...ADMIN_ROLES]);
  const payload = agentCreateSchema.parse(values);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    undefined;

  let redirectTo: string | undefined;

  const redirectBaseDomain = getInviteRedirectBaseDomain();
  if (redirectBaseDomain) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("slug")
      .eq("id", profile.tenant_id)
      .maybeSingle();

    if (tenant?.slug) {
      redirectTo = `https://${tenant.slug}.${redirectBaseDomain}/invite/accept`;
    }
  }

  if (!redirectTo && appUrl) {
    redirectTo = `${appUrl}/invite/accept`;
  }

  const { data: createdUser, error: userError } = await admin.auth.admin.inviteUserByEmail(
    payload.email,
    redirectTo ? { redirectTo } : undefined
  );
  if (userError || !createdUser?.user) {
    const message = userError?.message ?? "Unable to create user.";
    // Gracefully handle "already registered" so we can show a toast without a 500.
    if (message.toLowerCase().includes("already been registered")) {
      return {
        ok: false,
        error: "A user with this email already exists. Ask them to log in or reset their password."
      };
    }
    return { ok: false, error: message };
  }

  const userId = createdUser.user.id;

  const { error: profileError } = await admin.from("user_profiles").insert({
    id: userId,
    tenant_id: profile.tenant_id,
    role: payload.role,
    display_name: payload.display_name
  });
  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  const isAgent =
    payload.role === "agent" || payload.role === "agent_and_marketing" || payload.role === "admin";
  const isMarketing =
    payload.role === "marketing_only" ||
    payload.role === "agent_and_marketing" ||
    payload.role === "admin";

  const { error: agentError } = await admin.from("agent_profiles").insert({
    user_id: userId,
    tenant_id: profile.tenant_id,
    commission_percent: 0,
    marketing_fee: 0,
    role_flags: { is_agent: isAgent, is_marketing: isMarketing }
  });
  if (agentError) {
    return { ok: false, error: agentError.message };
  }

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "agent_created",
    entity_type: "agent",
    entity_id: userId,
    metadata: {
      email: payload.email,
      display_name: payload.display_name,
      role: payload.role
    }
  });

  revalidatePath("/agents");
  return { ok: true };
}

export async function setAgentDisabled(userId: string, disabled: boolean) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole([...ADMIN_ROLES]);

  const { error } = await supabase
    .from("agent_profiles")
    .update({ is_disabled: disabled })
    .eq("user_id", userId)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/agents");
  revalidatePath(`/agents/${userId}`);
  return { ok: true };
}
