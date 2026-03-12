import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import type {
  AdminActivityRow,
  AdminOverviewStats,
  TenantAccessProfile,
  TenantBrandingSettings,
  TenantDetails,
  TenantFeatureEntitlement,
  TenantListItem,
  TenantUserListItem
} from "../domain/types";
import { ALL_FEATURES } from "@/lib/entitlements/features";

const TENANTS_PAGE_SIZE = 25;

function toPermissions(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = Boolean(raw);
  }
  return out;
}

async function getAuthUsersEmailMap() {
  const admin = createSupabaseAdminClient();
  const pageSize = 500;
  let page = 1;
  const emailById = new Map<string, string | null>();

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: pageSize
    });
    if (error) throw new Error(error.message);

    const users = data?.users ?? [];
    users.forEach((user) => {
      emailById.set(user.id, user.email ?? null);
    });

    if (users.length < pageSize) break;
    page += 1;
  }

  return emailById;
}

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [
    { count: tenantsCount },
    { count: activeTenantsCount },
    { count: suspendedTenantsCount },
    { count: usersCount },
    { count: activeUsersCount },
    { count: profilesCount },
    { count: activityCountLast7Days }
  ] = await Promise.all([
    admin.from("tenants").select("id", { count: "exact", head: true }),
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .in("status", ["suspended", "inactive"]),
    admin.from("user_profiles").select("id", { count: "exact", head: true }),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("tenant_access_profiles").select("id", { count: "exact", head: true }),
    admin
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since.toISOString())
  ]);

  return {
    tenantsCount: tenantsCount ?? 0,
    activeTenantsCount: activeTenantsCount ?? 0,
    suspendedTenantsCount: suspendedTenantsCount ?? 0,
    usersCount: usersCount ?? 0,
    activeUsersCount: activeUsersCount ?? 0,
    profilesCount: profilesCount ?? 0,
    activityCountLast7Days: activityCountLast7Days ?? 0
  };
}

export async function getTenants(params?: {
  search?: string;
  status?: string;
  page?: number;
}): Promise<{
  tenants: TenantListItem[];
  total: number;
  page: number;
  totalPages: number;
}> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  const page = Math.max(1, params?.page ?? 1);
  const from = (page - 1) * TENANTS_PAGE_SIZE;
  const to = from + TENANTS_PAGE_SIZE - 1;

  let query = admin
    .from("tenants")
    .select("id, name, slug, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params?.search) {
    query = query.or(`name.ilike.%${params.search}%,slug.ilike.%${params.search}%`);
  }
  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    tenants: (data ?? []) as TenantListItem[],
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / TENANTS_PAGE_SIZE))
  };
}

export async function getTenantDetails(tenantId: string): Promise<TenantDetails | null> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: tenant, error } = await admin
    .from("tenants")
    .select("id, name, slug, status, created_at")
    .eq("id", tenantId)
    .single();
  if (error) return null;

  const [
    { count: usersCount },
    { count: activeUsersCount },
    { count: profilesCount },
    { data: branding }
  ] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    admin
      .from("tenant_access_profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    admin
      .from("tenant_branding_settings")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle()
  ]);

  return {
    ...(tenant as TenantListItem),
    usersCount: usersCount ?? 0,
    activeUsersCount: activeUsersCount ?? 0,
    profilesCount: profilesCount ?? 0,
    brandingConfigured: Boolean(branding?.tenant_id)
  };
}

export async function getTenantUsers(tenantId: string): Promise<TenantUserListItem[]> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: rows, error }, emailById] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id, tenant_id, display_name, role, is_active, profile_id, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    getAuthUsersEmailMap()
  ]);
  if (error) throw new Error(error.message);

  return (rows ?? []).map((row) => ({
    ...(row as Omit<TenantUserListItem, "email">),
    email: emailById.get(row.id) ?? null
  }));
}

export async function getTenantBrandingSettings(tenantId: string): Promise<TenantBrandingSettings | null> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenant_branding_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TenantBrandingSettings | null) ?? null;
}

export async function getTenantAccessProfiles(tenantId: string): Promise<TenantAccessProfile[]> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenant_access_profiles")
    .select("id, tenant_id, name, description, permissions, is_system, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    ...(row as Omit<TenantAccessProfile, "permissions">),
    permissions: toPermissions(row.permissions)
  }));
}

export async function getAdminActivity(params?: {
  tenantId?: string;
  action?: string;
  limit?: number;
}): Promise<AdminActivityRow[]> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  const limit = Math.min(Math.max(params?.limit ?? 100, 1), 300);

  let query = admin
    .from("activity_log")
    .select("id, tenant_id, actor_user_id, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params?.tenantId && params.tenantId !== "all") {
    query = query.eq("tenant_id", params.tenantId);
  }
  if (params?.action && params.action !== "all") {
    query = query.eq("action", params.action);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const tenantIds = Array.from(new Set(rows.map((row) => row.tenant_id)));
  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id)))
  );

  const [{ data: tenants }, { data: actors }] = await Promise.all([
    tenantIds.length
      ? admin.from("tenants").select("id, name").in("id", tenantIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    actorIds.length
      ? admin.from("user_profiles").select("id, display_name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] })
  ]);

  const tenantNameById = new Map((tenants ?? []).map((tenant) => [tenant.id, tenant.name]));
  const actorNameById = new Map((actors ?? []).map((actor) => [actor.id, actor.display_name]));

  return rows.map((row) => ({
    ...(row as Omit<AdminActivityRow, "tenant_name" | "actor_name" | "metadata">),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    tenant_name: tenantNameById.get(row.tenant_id) ?? null,
    actor_name: row.actor_user_id ? actorNameById.get(row.actor_user_id) ?? null : null
  }));
}

export async function getTenantSelectOptions(): Promise<Array<{ id: string; name: string }>> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTenantFeatureEntitlements(
  tenantId: string
): Promise<TenantFeatureEntitlement[]> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenant_feature_entitlements")
    .select("tenant_id, feature_key, is_enabled, ends_on, updated_at")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const byKey = new Map((data ?? []).map((row) => [row.feature_key, row]));

  return ALL_FEATURES.map((feature) => {
    const row = byKey.get(feature);
    return {
      tenant_id: tenantId,
      feature_key: feature,
      is_enabled: row ? Boolean(row.is_enabled) : true,
      ends_on: row?.ends_on ?? null,
      updated_at: row?.updated_at ?? new Date(0).toISOString()
    };
  });
}

