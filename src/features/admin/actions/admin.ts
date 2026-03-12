"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function logAdminAction(
  actorUserId: string,
  tenantId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>
) {
  const admin = createSupabaseAdminClient();
  await admin.from("activity_log").insert({
    tenant_id: tenantId,
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null
  });
}

export async function createTenantAction(input: {
  name: string;
  slug: string;
  status?: "active" | "suspended";
}): Promise<{ ok: boolean; tenantId?: string; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  const status = input.status ?? "active";

  if (!name) return { ok: false, error: "Tenant name is required." };
  if (!slug) return { ok: false, error: "Tenant slug is required." };

  const { data, error } = await admin
    .from("tenants")
    .insert({ name, slug, status })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAdminAction(actor.id, data.id, "admin_tenant_created", "tenant", data.id, {
    name,
    slug,
    status
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  return { ok: true, tenantId: data.id };
}

export async function updateTenantAction(input: {
  tenantId: string;
  name: string;
  slug: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  if (!name) return { ok: false, error: "Tenant name is required." };
  if (!slug) return { ok: false, error: "Tenant slug is required." };

  const { error } = await admin
    .from("tenants")
    .update({ name, slug })
    .eq("id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(actor.id, input.tenantId, "admin_tenant_updated", "tenant", input.tenantId, {
    name,
    slug
  });

  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${input.tenantId}`);
  return { ok: true };
}

export async function setTenantStatusAction(input: {
  tenantId: string;
  status: "active" | "suspended";
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("tenants")
    .update({ status: input.status })
    .eq("id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_tenant_status_updated",
    "tenant",
    input.tenantId,
    { status: input.status }
  );

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${input.tenantId}`);
  return { ok: true };
}

export async function setTenantUserStatusAction(input: {
  tenantId: string;
  userId: string;
  isActive: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("user_profiles")
    .update({ is_active: input.isActive })
    .eq("id", input.userId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(actor.id, input.tenantId, "admin_tenant_user_status_updated", "user", input.userId, {
    is_active: input.isActive
  });

  revalidatePath(`/admin/tenants/${input.tenantId}/users`);
  return { ok: true };
}

export async function setTenantUserRoleAction(input: {
  tenantId: string;
  userId: string;
  role: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  const role = input.role.trim().toLowerCase();

  if (!role) return { ok: false, error: "Role is required." };

  const { error } = await admin
    .from("user_profiles")
    .update({ role })
    .eq("id", input.userId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(actor.id, input.tenantId, "admin_tenant_user_role_updated", "user", input.userId, {
    role
  });

  revalidatePath(`/admin/tenants/${input.tenantId}/users`);
  return { ok: true };
}

export async function assignTenantUserProfileAction(input: {
  tenantId: string;
  userId: string;
  profileId: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("user_profiles")
    .update({ profile_id: input.profileId })
    .eq("id", input.userId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(actor.id, input.tenantId, "admin_tenant_user_profile_assigned", "user", input.userId, {
    profile_id: input.profileId
  });

  revalidatePath(`/admin/tenants/${input.tenantId}/users`);
  revalidatePath(`/admin/tenants/${input.tenantId}/profiles`);
  return { ok: true };
}

export async function saveTenantBrandingAction(input: {
  tenantId: string;
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themeMode: "light" | "dark" | "system";
  fontFamily: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const payload = {
    tenant_id: input.tenantId,
    brand_name: input.brandName.trim() || null,
    logo_url: input.logoUrl.trim() || null,
    primary_color: input.primaryColor.trim() || "#0B2F59",
    secondary_color: input.secondaryColor.trim() || "#6BB0D0",
    accent_color: input.accentColor.trim() || "#4FD1FF",
    theme_mode: input.themeMode,
    font_family: input.fontFamily.trim() || null,
    updated_at: new Date().toISOString()
  };

  const { error } = await admin.from("tenant_branding_settings").upsert(payload, {
    onConflict: "tenant_id"
  });
  if (error) return { ok: false, error: error.message };

  await logAdminAction(actor.id, input.tenantId, "admin_tenant_branding_updated", "tenant_branding", input.tenantId, {
    brand_name: payload.brand_name,
    theme_mode: payload.theme_mode
  });

  revalidatePath(`/admin/tenants/${input.tenantId}/branding`);
  revalidatePath(`/admin/tenants/${input.tenantId}`);
  return { ok: true };
}

export async function upsertTenantAccessProfileAction(input: {
  tenantId: string;
  profileId?: string;
  name: string;
  description?: string;
  permissions?: Record<string, boolean>;
}): Promise<{ ok: boolean; profileId?: string; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Profile name is required." };

  const payload = {
    tenant_id: input.tenantId,
    name,
    description: input.description?.trim() || null,
    permissions: input.permissions ?? {}
  };

  if (input.profileId) {
    const { error } = await admin
      .from("tenant_access_profiles")
      .update(payload)
      .eq("id", input.profileId)
      .eq("tenant_id", input.tenantId);
    if (error) return { ok: false, error: error.message };

    await logAdminAction(
      actor.id,
      input.tenantId,
      "admin_tenant_profile_updated",
      "tenant_profile",
      input.profileId,
      { name }
    );

    revalidatePath(`/admin/tenants/${input.tenantId}/profiles`);
    return { ok: true, profileId: input.profileId };
  }

  const { data, error } = await admin
    .from("tenant_access_profiles")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_tenant_profile_created",
    "tenant_profile",
    data.id,
    { name }
  );

  revalidatePath(`/admin/tenants/${input.tenantId}/profiles`);
  return { ok: true, profileId: data.id };
}

export async function deleteTenantAccessProfileAction(input: {
  tenantId: string;
  profileId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: profile, error: fetchError } = await admin
    .from("tenant_access_profiles")
    .select("id, is_system")
    .eq("id", input.profileId)
    .eq("tenant_id", input.tenantId)
    .single();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (profile.is_system) return { ok: false, error: "System profiles cannot be deleted." };

  const { error: clearError } = await admin
    .from("user_profiles")
    .update({ profile_id: null })
    .eq("tenant_id", input.tenantId)
    .eq("profile_id", input.profileId);
  if (clearError) return { ok: false, error: clearError.message };

  const { error } = await admin
    .from("tenant_access_profiles")
    .delete()
    .eq("id", input.profileId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_tenant_profile_deleted",
    "tenant_profile",
    input.profileId
  );

  revalidatePath(`/admin/tenants/${input.tenantId}/profiles`);
  revalidatePath(`/admin/tenants/${input.tenantId}/users`);
  return { ok: true };
}

export async function resendInviteForUserAction(input: {
  tenantId: string;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  if (listError) return { ok: false, error: listError.message };
  const email = listed?.users?.find((user) => user.id === input.userId)?.email;
  if (!email) return { ok: false, error: "User email not found." };

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/invite/accept`
  });
  if (error) return { ok: false, error: error.message };

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_tenant_user_invite_resent",
    "user",
    input.userId,
    { email }
  );

  revalidatePath(`/admin/tenants/${input.tenantId}/users`);
  return { ok: true };
}

export async function inviteSuperAdminAction(input: {
  email: string;
  displayName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || email.split("@")[0] || "Super Admin";
  if (!email) return { ok: false, error: "Email is required." };

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/invite/accept`
  });
  if (inviteError || !invited?.user?.id) {
    const message = inviteError?.message ?? "Unable to send invite.";
    if (message.toLowerCase().includes("already been registered")) {
      return {
        ok: false,
        error:
          "This email is already registered. Promote that account manually in Users/DB or use a new email."
      };
    }
    return { ok: false, error: message };
  }

  const invitedUserId = invited.user.id;

  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", invitedUserId)
    .maybeSingle();

  if (existingProfile?.id) {
    const { error: updateError } = await admin
      .from("user_profiles")
      .update({
        role: "super_admin",
        display_name: displayName
      })
      .eq("id", invitedUserId);
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    const { error: insertError } = await admin.from("user_profiles").insert({
      id: invitedUserId,
      tenant_id: actor.tenant_id,
      role: "super_admin",
      display_name: displayName
    });
    if (insertError) return { ok: false, error: insertError.message };
  }

  await logAdminAction(actor.id, actor.tenant_id, "admin_super_admin_invited", "user", invitedUserId, {
    email,
    display_name: displayName
  });

  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  return { ok: true };
}

export async function setTenantFeatureEnabledAction(input: {
  tenantId: string;
  featureKey: string;
  enabled: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const payload = {
    tenant_id: input.tenantId,
    feature_key: input.featureKey,
    is_enabled: input.enabled,
    updated_at: new Date().toISOString()
  };

  const { error } = await admin.from("tenant_feature_entitlements").upsert(payload, {
    onConflict: "tenant_id,feature_key"
  });
  if (error) return { ok: false, error: error.message };

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_tenant_feature_toggled",
    "tenant_feature",
    input.tenantId,
    { feature_key: input.featureKey, is_enabled: input.enabled }
  );

  revalidatePath(`/admin/tenants/${input.tenantId}/features`);
  return { ok: true };
}

export async function setTenantFeatureEndDateAction(input: {
  tenantId: string;
  featureKey: string;
  endsOn: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const payload = {
    tenant_id: input.tenantId,
    feature_key: input.featureKey,
    ends_on: input.endsOn,
    updated_at: new Date().toISOString()
  };

  const { error } = await admin.from("tenant_feature_entitlements").upsert(payload, {
    onConflict: "tenant_id,feature_key"
  });
  if (error) return { ok: false, error: error.message };

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_tenant_feature_end_date_updated",
    "tenant_feature",
    input.tenantId,
    { feature_key: input.featureKey, ends_on: input.endsOn }
  );

  revalidatePath(`/admin/tenants/${input.tenantId}/features`);
  return { ok: true };
}

