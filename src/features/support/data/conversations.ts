import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TriageContext, TriageMessage } from "@/lib/ai/maintenance-triage";

function buildUnitLabel(unit: {
  unit_type: string;
  room_number: string | null;
  room_type: string | null;
}): string {
  if (unit.unit_type === "room") {
    const rn = unit.room_number ? `Room ${unit.room_number}` : "Room";
    const rt = unit.room_type
      ? ` · ${unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)}`
      : "";
    return `${rn}${rt}`;
  }
  return unit.unit_type === "studio" ? "Studio" : "Whole flat";
}

function buildAddress(p: {
  address_line_1: string;
  address_line_2: string | null;
  postcode: string | null;
  area: string | null;
}): string {
  return [p.address_line_1, p.address_line_2, p.area, p.postcode]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(", ");
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export type ConversationContextBundle = {
  conversationId: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  pmTenantId: string;
  turnCount: number;
  status: string;
  triage: TriageContext;
};

/**
 * Validates that the unit belongs to the tenant and the pmTenant is currently
 * occupying it, then creates a new conversation row.
 */
export async function createConversation(args: {
  tenantId: string;
  propertyId: string;
  unitId: string;
  pmTenantId: string;
}): Promise<ConversationContextBundle | null> {
  const admin = createSupabaseAdminClient();

  const { data: unit } = await admin
    .from("units")
    .select(
      "id, tenant_id, property_id, pm_tenant_id, unit_type, room_number, room_type, notes"
    )
    .eq("id", args.unitId)
    .maybeSingle();

  if (
    !unit ||
    unit.tenant_id !== args.tenantId ||
    unit.property_id !== args.propertyId ||
    unit.pm_tenant_id !== args.pmTenantId
  ) {
    return null;
  }

  const [{ data: property }, { data: pmTenant }, { data: company }] = await Promise.all([
    admin
      .from("properties")
      .select("id, tenant_id, address_line_1, address_line_2, postcode, area, notes")
      .eq("id", args.propertyId)
      .maybeSingle(),
    admin
      .from("pm_tenants")
      .select("id, tenant_id, full_name")
      .eq("id", args.pmTenantId)
      .maybeSingle(),
    admin
      .from("tenants")
      .select("id, name, alert_phone")
      .eq("id", args.tenantId)
      .maybeSingle(),
  ]);

  if (
    !property ||
    property.tenant_id !== args.tenantId ||
    !pmTenant ||
    pmTenant.tenant_id !== args.tenantId ||
    !company
  ) {
    return null;
  }

  const { data: created, error } = await admin
    .from("maintenance_conversations")
    .insert({
      tenant_id: args.tenantId,
      property_id: args.propertyId,
      unit_id: args.unitId,
      pm_tenant_id: args.pmTenantId,
      status: "active",
      turn_count: 0,
    })
    .select("id, turn_count, status")
    .single();

  if (error || !created) return null;

  return {
    conversationId: created.id as string,
    tenantId: args.tenantId,
    propertyId: args.propertyId,
    unitId: args.unitId,
    pmTenantId: args.pmTenantId,
    turnCount: created.turn_count as number,
    status: created.status as string,
    triage: {
      companyName: company.name as string,
      tenantFirstName: firstNameOf(pmTenant.full_name as string),
      propertyAddress: buildAddress({
        address_line_1: property.address_line_1 as string,
        address_line_2: (property.address_line_2 as string | null) ?? null,
        postcode: (property.postcode as string | null) ?? null,
        area: (property.area as string | null) ?? null,
      }),
      roomLabel: buildUnitLabel({
        unit_type: unit.unit_type as string,
        room_number: (unit.room_number as string | null) ?? null,
        room_type: (unit.room_type as string | null) ?? null,
      }),
      propertyNotes: (property.notes as string | null) ?? null,
      roomNotes: (unit.notes as string | null) ?? null,
      landlordPhone: (company.alert_phone as string | null) ?? null,
    },
  };
}

/**
 * Loads the conversation + all context needed to run another AI turn.
 * Returns null if the conversation doesn't belong to the given tenant or isn't active.
 */
export async function loadConversationContext(args: {
  conversationId: string;
  tenantId: string;
}): Promise<ConversationContextBundle | null> {
  const admin = createSupabaseAdminClient();

  const { data: conv } = await admin
    .from("maintenance_conversations")
    .select("id, tenant_id, property_id, unit_id, pm_tenant_id, turn_count, status")
    .eq("id", args.conversationId)
    .maybeSingle();

  if (!conv || conv.tenant_id !== args.tenantId) return null;

  const [{ data: property }, { data: unit }, { data: pmTenant }, { data: company }] =
    await Promise.all([
      admin
        .from("properties")
        .select("id, address_line_1, address_line_2, postcode, area, notes")
        .eq("id", conv.property_id)
        .maybeSingle(),
      admin
        .from("units")
        .select("id, unit_type, room_number, room_type, notes")
        .eq("id", conv.unit_id)
        .maybeSingle(),
      admin
        .from("pm_tenants")
        .select("id, full_name")
        .eq("id", conv.pm_tenant_id)
        .maybeSingle(),
      admin
      .from("tenants")
      .select("id, name, alert_phone")
      .eq("id", args.tenantId)
      .maybeSingle(),
    ]);

  if (!property || !unit || !pmTenant || !company) return null;

  return {
    conversationId: conv.id as string,
    tenantId: args.tenantId,
    propertyId: conv.property_id as string,
    unitId: conv.unit_id as string,
    pmTenantId: conv.pm_tenant_id as string,
    turnCount: conv.turn_count as number,
    status: conv.status as string,
    triage: {
      companyName: company.name as string,
      tenantFirstName: firstNameOf(pmTenant.full_name as string),
      propertyAddress: buildAddress({
        address_line_1: property.address_line_1 as string,
        address_line_2: (property.address_line_2 as string | null) ?? null,
        postcode: (property.postcode as string | null) ?? null,
        area: (property.area as string | null) ?? null,
      }),
      roomLabel: buildUnitLabel({
        unit_type: unit.unit_type as string,
        room_number: (unit.room_number as string | null) ?? null,
        room_type: (unit.room_type as string | null) ?? null,
      }),
      propertyNotes: (property.notes as string | null) ?? null,
      roomNotes: (unit.notes as string | null) ?? null,
      landlordPhone: (company.alert_phone as string | null) ?? null,
    },
  };
}

export async function loadConversationHistory(
  conversationId: string
): Promise<TriageMessage[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("maintenance_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (data ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));
}

export async function appendMessage(args: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("maintenance_messages").insert({
    conversation_id: args.conversationId,
    role: args.role,
    content: args.content,
  });
}

export async function markConversationEmergency(args: {
  conversationId: string;
  emergencyType: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("maintenance_conversations")
    .update({
      status: "emergency",
      emergency_type: args.emergencyType,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", args.conversationId);
}

export async function incrementTurnCount(conversationId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("maintenance_conversations")
    .select("turn_count")
    .eq("id", conversationId)
    .single();

  const next = (existing?.turn_count ?? 0) + 1;
  await admin
    .from("maintenance_conversations")
    .update({ turn_count: next })
    .eq("id", conversationId);
  return next;
}
