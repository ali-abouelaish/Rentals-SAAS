"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import {
  auditDiff,
  logPlatformAudit,
  type PlatformAuditCategory
} from "@/lib/audit/platformAudit";

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

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Categories for the admin action names below.
 *
 * Keyed by prefix so a new `admin_tenant_*` action is categorised without
 * touching this map. Order matters: the first matching prefix wins, so the more
 * specific entries come first.
 */
const AUDIT_CATEGORY_BY_PREFIX: [string, PlatformAuditCategory][] = [
  ["admin_super_admin_", "security"],
  ["admin_tenant_user_", "access"],
  ["admin_tenant_profile_", "access"],
  ["admin_tenant_feature_", "billing"],
  ["admin_module_config_", "tenant"],
  ["admin_tenant_branding_", "tenant"],
  ["admin_tenant_", "tenant"]
];

function categoryForAction(action: string): PlatformAuditCategory {
  for (const [prefix, category] of AUDIT_CATEGORY_BY_PREFIX) {
    if (action.startsWith(prefix)) return category;
  }
  return "tenant";
}

/**
 * Record a super-admin action.
 *
 * Writes to `platform_audit_log`, NOT `activity_log`. These are our operational
 * records: an agency should not read in its own activity feed that we suspended
 * it or changed its entitlements, and a platform-wide action has no agency to
 * attribute to at all. See 20260913000002_platform_audit_log.sql.
 *
 * The positional signature is kept from the original helper so every existing
 * call site reads the same; `options` carries the richer fields where a call
 * site has something worth recording.
 */
async function logAdminAction(
  actorUserId: string,
  tenantId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
  options?: {
    summary?: string;
    category?: PlatformAuditCategory;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    severity?: "info" | "warning" | "error";
  }
) {
  await logPlatformAudit({
    actor: { id: actorUserId },
    category: options?.category ?? categoryForAction(action),
    action,
    // Falls back to the action name made readable. Every call site should pass
    // a real summary, but a derived one keeps a new action legible immediately
    // rather than blank.
    summary: options?.summary ?? action.replace(/^admin_/, "").replaceAll("_", " "),
    tenantId,
    entityType,
    entityId,
    before: options?.before ?? null,
    after: options?.after ?? null,
    metadata,
    severity: options?.severity
  });
}

export async function createTenantAction(input: {
  name: string;
  slug: string;
  contactEmail: string;
  status?: "active" | "suspended";
}): Promise<{ ok: boolean; tenantId?: string; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  const contact_email = input.contactEmail.trim().toLowerCase();
  const status = input.status ?? "active";

  if (!name) return { ok: false, error: "Tenant name is required." };
  if (!slug) return { ok: false, error: "Tenant slug is required." };
  if (!contact_email) return { ok: false, error: "Contact email is required." };
  if (!EMAIL_RE.test(contact_email)) {
    return { ok: false, error: "Contact email is not a valid email address." };
  }

  const { data, error } = await admin
    .from("tenants")
    .insert({ name, slug, contact_email, status })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAdminAction(actor.id, data.id, "admin_tenant_created", "tenant", data.id, {
    name,
    slug,
    contact_email,
    status
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  return { ok: true, tenantId: data.id };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateTenantAction(input: {
  tenantId: string;
  name: string;
  slug: string;
  contactEmail: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  const contact_email = input.contactEmail.trim();
  if (!name) return { ok: false, error: "Tenant name is required." };
  if (!slug) return { ok: false, error: "Tenant slug is required." };
  if (!contact_email) return { ok: false, error: "Contact email is required." };
  if (!EMAIL_RE.test(contact_email)) {
    return { ok: false, error: "Contact email is not a valid email address." };
  }

  const { error } = await admin
    .from("tenants")
    .update({ name, slug, contact_email })
    .eq("id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(actor.id, input.tenantId, "admin_tenant_updated", "tenant", input.tenantId, {
    name,
    slug,
    contact_email
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

  // Read before writing so the audit row records what it changed FROM.
  // Suspending an agency is the most consequential action on this screen and
  // "status: suspended" alone does not say whether it was already suspended.
  const { data: prior } = await admin
    .from("tenants")
    .select("name, status")
    .eq("id", input.tenantId)
    .maybeSingle();

  const { error } = await admin
    .from("tenants")
    .update({ status: input.status })
    .eq("id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  const diff = auditDiff(
    prior ? { status: prior.status } : null,
    { status: input.status }
  );

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_tenant_status_updated",
    "tenant",
    input.tenantId,
    { status: input.status },
    {
      summary: `${prior?.name ?? "Agency"} ${
        input.status === "suspended" ? "suspended" : "reactivated"
      }`,
      before: diff.before,
      after: diff.after,
      // A suspension cuts off a paying customer's access. It should stand out
      // in a log that is mostly routine.
      severity: input.status === "suspended" ? "warning" : "info"
    }
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

  const { data: prior } = await admin
    .from("user_profiles")
    .select("role, display_name")
    .eq("id", input.userId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  const { error } = await admin
    .from("user_profiles")
    .update({ role })
    .eq("id", input.userId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  const diff = auditDiff(prior ? { role: prior.role } : null, { role });

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_tenant_user_role_updated",
    "user",
    input.userId,
    { role, previous_role: prior?.role ?? null },
    {
      summary: `${prior?.display_name ?? "User"} role ${
        prior?.role ? `${prior.role} → ${role}` : `set to ${role}`
      }`,
      before: diff.before,
      after: diff.after,
      // A privilege change is a security event, and an escalation to admin or
      // super_admin is the one an incident review will come looking for.
      category: role === "super_admin" || prior?.role === "super_admin" ? "security" : "access",
      severity: role === "super_admin" ? "warning" : "info"
    }
  );

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

const TENANT_BRANDING_BUCKET = "tenant-branding";

export async function uploadTenantLogoAction(
  tenantId: string,
  formData: FormData
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  const file = formData.get("file") as File | null;
  if (!file?.size) return { ok: false, error: "No file provided" };
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const allowed = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
  if (!allowed.includes(ext)) return { ok: false, error: "Allowed: " + allowed.join(", ") };

  const { error: bucketErr } = await admin.storage.getBucket(TENANT_BRANDING_BUCKET);
  if (bucketErr) {
    const { error: createErr } = await admin.storage.createBucket(TENANT_BRANDING_BUCKET, { public: true });
    if (createErr) return { ok: false, error: createErr.message };
  }

  const path = `${tenantId}/logo.${ext}`;
  const { error: uploadErr } = await admin.storage
    .from(TENANT_BRANDING_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data: urlData } = admin.storage.from(TENANT_BRANDING_BUCKET).getPublicUrl(path);

  // `upsert: true` overwrites the agency's existing logo at a fixed path, so the
  // previous file is gone. Worth a record of who replaced it and when.
  await logAdminAction(
    actor.id,
    tenantId,
    "admin_tenant_branding_logo_uploaded",
    "tenant_branding",
    tenantId,
    { path, content_type: file.type || null, bytes: file.size },
    { summary: "Agency logo replaced" }
  );

  revalidatePath(`/admin/tenants/${tenantId}/branding`);
  return { ok: true, url: urlData.publicUrl };
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

  let redirectTo = `${appUrl}/invite/accept`;
  const redirectBaseDomain = getInviteRedirectBaseDomain();
  if (redirectBaseDomain) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("slug")
      .eq("id", input.tenantId)
      .maybeSingle();

    if (tenant?.slug) {
      redirectTo = `https://${tenant.slug}.${redirectBaseDomain}/invite/accept`;
    }
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo
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

const TENANT_USER_ROLES = ["super_admin", "admin", "agent", "marketing_only"];

/**
 * Super-admin action: invite a brand-new user directly into a specific tenant.
 * Sends the Supabase invite email (redirecting to the tenant's own subdomain),
 * creates the user_profiles row, and — for non-super-admin roles — the
 * agent_profiles row so the user shows up in the tenant's Agents/Team views.
 */
export async function inviteTenantUserAction(input: {
  tenantId: string;
  email: string;
  displayName?: string;
  role: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const email = input.email.trim().toLowerCase();
  const role = input.role.trim().toLowerCase();
  const displayName = input.displayName?.trim() || email.split("@")[0] || "New user";

  if (!email) return { ok: false, error: "Email is required." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!TENANT_USER_ROLES.includes(role)) return { ok: false, error: "Select a valid role." };

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", input.tenantId)
    .maybeSingle();
  if (tenantError) return { ok: false, error: tenantError.message };
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";

  let redirectTo = `${appUrl}/invite/accept`;
  const redirectBaseDomain = getInviteRedirectBaseDomain();
  if (redirectBaseDomain && tenant.slug) {
    redirectTo = `https://${tenant.slug}.${redirectBaseDomain}/invite/accept`;
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo
  });
  if (inviteError || !invited?.user?.id) {
    const message = inviteError?.message ?? "Unable to send invite.";
    if (message.toLowerCase().includes("already been registered")) {
      return {
        ok: false,
        error:
          "This email is already registered. Ask them to sign in, or manage the existing account instead."
      };
    }
    return { ok: false, error: message };
  }

  const userId = invited.user.id;

  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile?.id) {
    const { error: updateError } = await admin
      .from("user_profiles")
      .update({ tenant_id: input.tenantId, role, display_name: displayName })
      .eq("id", userId);
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    const { error: insertError } = await admin.from("user_profiles").insert({
      id: userId,
      tenant_id: input.tenantId,
      role,
      display_name: displayName
    });
    if (insertError) return { ok: false, error: insertError.message };
  }

  // Tenant staff (admin/agent/marketing) need an agent_profiles row for role_flags,
  // commission, and disable state. Super admins don't (they have no such row).
  if (role !== "super_admin") {
    const isAgent = role === "agent" || role === "admin";
    const isMarketing = role === "agent" || role === "marketing_only" || role === "admin";
    const roleFlags = { is_agent: isAgent, is_marketing: isMarketing };

    const { data: existingAgent } = await admin
      .from("agent_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingAgent?.user_id) {
      const { error: agentError } = await admin
        .from("agent_profiles")
        .update({ tenant_id: input.tenantId, role_flags: roleFlags })
        .eq("user_id", userId);
      if (agentError) return { ok: false, error: agentError.message };
    } else {
      const { error: agentError } = await admin.from("agent_profiles").insert({
        user_id: userId,
        tenant_id: input.tenantId,
        commission_percent: 0,
        marketing_fee: 0,
        role_flags: roleFlags
      });
      if (agentError) return { ok: false, error: agentError.message };
    }
  }

  await logAdminAction(actor.id, input.tenantId, "admin_tenant_user_invited", "user", userId, {
    email,
    role,
    display_name: displayName
  });

  revalidatePath(`/admin/tenants/${input.tenantId}/users`);
  revalidatePath(`/admin/tenants/${input.tenantId}`);
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

  let redirectTo = `${appUrl}/invite/accept`;
  const redirectBaseDomain = getInviteRedirectBaseDomain();
  if (redirectBaseDomain) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("slug")
      .eq("id", actor.tenant_id)
      .maybeSingle();

    if (tenant?.slug) {
      redirectTo = `https://${tenant.slug}.${redirectBaseDomain}/invite/accept`;
    }
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo
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

  // tenantId is null, not actor.tenant_id. Creating a super admin is a
  // platform-wide act with no subject agency — attributing it to whichever
  // agency the inviter happens to belong to made it look like an event in that
  // agency's life, and (while this was in activity_log) let that agency read it.
  await logAdminAction(
    actor.id,
    null,
    "admin_super_admin_invited",
    "user",
    invitedUserId,
    { email, display_name: displayName },
    {
      summary: `Super admin invited: ${email}`,
      category: "security",
      // The highest-privilege grant in the system. An incident review starts here.
      severity: "warning"
    }
  );

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

  // A missing row is not "disabled" — it means the default applies, which for a
  // paid feature is off and for everything else is on. Recorded as null so the
  // audit trail distinguishes "was explicitly off" from "had never been set".
  const { data: prior } = await admin
    .from("tenant_feature_entitlements")
    .select("is_enabled")
    .eq("tenant_id", input.tenantId)
    .eq("feature_key", input.featureKey)
    .maybeSingle();

  const { error } = await admin.from("tenant_feature_entitlements").upsert(payload, {
    onConflict: "tenant_id,feature_key"
  });
  if (error) return { ok: false, error: error.message };

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_tenant_feature_toggled",
    "tenant_feature",
    // The feature key, not the tenant id — the entitlement is the subject here,
    // and keying on the tenant made every feature change look like the same row.
    input.featureKey,
    { feature_key: input.featureKey, is_enabled: input.enabled },
    {
      summary: `Feature ${input.featureKey} ${input.enabled ? "enabled" : "disabled"}`,
      before: { is_enabled: prior ? prior.is_enabled : null },
      after: { is_enabled: input.enabled }
    }
  );

  revalidatePath(`/admin/tenants/${input.tenantId}/features`);
  return { ok: true };
}

export async function saveModuleConfigDraftAction(input: {
  tenantId: string;
  rentalAgencyEnabled: boolean;
  propertyManagementEnabled: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const payload = {
    tenant_id: input.tenantId,
    rental_agency_enabled: input.rentalAgencyEnabled,
    property_management_enabled: input.propertyManagementEnabled,
    published: false,
    last_updated_at: new Date().toISOString(),
    last_updated_by: actor.id
  };

  const { error } = await admin
    .from("agency_module_configs")
    .upsert(payload, { onConflict: "tenant_id" });
  if (error) return { ok: false, error: error.message };

  // Draft saves were previously unaudited — only publish was recorded. A draft
  // is not live, but it is the step where a decision gets made, and a publish
  // with no preceding draft in the log has no explanation.
  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_module_config_draft_saved",
    "agency_module_config",
    input.tenantId,
    {
      rental_agency_enabled: input.rentalAgencyEnabled,
      property_management_enabled: input.propertyManagementEnabled
    },
    { summary: "Module config draft saved (not yet live)" }
  );

  revalidatePath(`/admin/tenants/${input.tenantId}/modules`);
  return { ok: true };
}

export async function publishModuleConfigAction(input: {
  tenantId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: current, error: fetchError } = await admin
    .from("agency_module_configs")
    .select("rental_agency_enabled, property_management_enabled")
    .eq("tenant_id", input.tenantId)
    .single();
  if (fetchError || !current) {
    return { ok: false, error: "No draft config found. Save a draft first." };
  }

  const { error } = await admin
    .from("agency_module_configs")
    .update({
      live_rental_agency_enabled: current.rental_agency_enabled,
      live_property_management_enabled: current.property_management_enabled,
      published: true,
      published_at: new Date().toISOString(),
      published_by: actor.id
    })
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_module_config_published",
    "agency_module_config",
    input.tenantId,
    {
      rental_agency_enabled: current.rental_agency_enabled,
      property_management_enabled: current.property_management_enabled
    }
  );

  revalidatePath(`/admin/tenants/${input.tenantId}/modules`);
  return { ok: true };
}

export async function revertModuleConfigAction(input: {
  tenantId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: current, error: fetchError } = await admin
    .from("agency_module_configs")
    .select("live_rental_agency_enabled, live_property_management_enabled")
    .eq("tenant_id", input.tenantId)
    .single();
  if (fetchError || !current) {
    return { ok: false, error: "No published config to revert to." };
  }

  const { error } = await admin
    .from("agency_module_configs")
    .update({
      rental_agency_enabled: current.live_rental_agency_enabled,
      property_management_enabled: current.live_property_management_enabled,
      published: true,
      last_updated_at: new Date().toISOString(),
      last_updated_by: actor.id
    })
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };

  // A revert discards unpublished work. Previously unaudited, which meant a
  // draft could vanish with nothing recording that anyone did it.
  await logAdminAction(
    actor.id,
    input.tenantId,
    "admin_module_config_reverted",
    "agency_module_config",
    input.tenantId,
    {
      rental_agency_enabled: current.live_rental_agency_enabled,
      property_management_enabled: current.live_property_management_enabled
    },
    {
      summary: "Module config draft discarded, reverted to live",
      severity: "warning"
    }
  );

  revalidatePath(`/admin/tenants/${input.tenantId}/modules`);
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

