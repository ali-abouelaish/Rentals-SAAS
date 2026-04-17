import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  TicketStatus,
  TicketPriority,
  MaintenanceTicketListItem,
  MaintenanceTicketAttachment,
  MaintenanceTicketMessage,
  MaintenanceTicketDetail,
} from "../domain/ticket-types";

export type {
  TicketStatus,
  TicketPriority,
  MaintenanceTicketListItem,
  MaintenanceTicketAttachment,
  MaintenanceTicketMessage,
  MaintenanceTicketDetail,
};

function buildUnitLabel(
  unit: { unit_type: string; room_number: number | string | null; room_type: string | null } | null
): string {
  if (!unit) return "Unit";
  if (unit.unit_type === "room") {
    const rn = unit.room_number ? `Room ${unit.room_number}` : "Room";
    const rt = unit.room_type
      ? ` · ${unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)}`
      : "";
    return `${rn}${rt}`;
  }
  return unit.unit_type === "studio" ? "Studio" : "Whole flat";
}

type TicketRow = {
  id: string;
  reference: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  seen_by_landlord: boolean;
  created_at: string;
  resolved_at: string | null;
  property_id: string;
  unit_id: string;
  conversation_id: string | null;
  properties: { name: string } | { name: string }[] | null;
  units:
    | { unit_type: string; room_number: number | null; room_type: string | null }
    | { unit_type: string; room_number: number | null; room_type: string | null }[]
    | null;
  pm_tenants: { full_name: string; email: string | null; phone: string | null } | { full_name: string; email: string | null; phone: string | null }[] | null;
  maintenance_conversations: { emergency_type: string | null } | { emergency_type: string | null }[] | null;
};

function firstOrValue<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapListRow(r: TicketRow, attachmentCount: number): MaintenanceTicketListItem {
  const prop = firstOrValue(r.properties);
  const unit = firstOrValue(r.units);
  const pm = firstOrValue(r.pm_tenants);
  const conv = firstOrValue(r.maintenance_conversations);
  return {
    id: r.id,
    reference: r.reference,
    description: r.description,
    priority: r.priority,
    status: r.status,
    seen_by_landlord: r.seen_by_landlord,
    created_at: r.created_at,
    resolved_at: r.resolved_at,
    property_id: r.property_id,
    unit_id: r.unit_id,
    conversation_id: r.conversation_id,
    property_name: prop?.name ?? "Unknown",
    unit_label: buildUnitLabel(unit),
    pm_tenant_name: pm?.full_name ?? "Unknown",
    pm_tenant_email: pm?.email ?? null,
    pm_tenant_phone: pm?.phone ?? null,
    emergency_type: conv?.emergency_type ?? null,
    attachment_count: attachmentCount,
  };
}

export async function getAllMaintenanceTickets(): Promise<MaintenanceTicketListItem[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("maintenance_tickets")
      .select(
        `id, reference, description, priority, status, seen_by_landlord,
         created_at, resolved_at, property_id, unit_id, conversation_id,
         properties(name),
         units(unit_type, room_number, room_type),
         pm_tenants(full_name, email, phone),
         maintenance_conversations(emergency_type)`
      )
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as unknown as TicketRow[];
    if (rows.length === 0) return [];

    // Count attachments per ticket in one query (parent_id is polymorphic — no FK join)
    const ids = rows.map((r) => r.id);
    const { data: attRows } = await supabase
      .from("maintenance_attachments")
      .select("parent_id")
      .eq("parent_type", "ticket")
      .in("parent_id", ids);

    const countMap = new Map<string, number>();
    for (const a of (attRows ?? []) as Array<{ parent_id: string }>) {
      countMap.set(a.parent_id, (countMap.get(a.parent_id) ?? 0) + 1);
    }

    return rows.map((r) => mapListRow(r, countMap.get(r.id) ?? 0));
  } catch (err) {
    console.error("getAllMaintenanceTickets error:", err);
    return [];
  }
}

export async function getMaintenanceTicket(
  ticketId: string
): Promise<MaintenanceTicketDetail | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select(
      `id, reference, description, priority, status, seen_by_landlord,
       created_at, resolved_at, property_id, unit_id, conversation_id, tenant_id,
       properties(name),
       units(unit_type, room_number, room_type),
       pm_tenants(full_name, email, phone),
       maintenance_conversations(emergency_type)`
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as TicketRow & { tenant_id: string };
  const base = mapListRow(row, 0);

  const admin = createSupabaseAdminClient();

  const [{ data: atts }, { data: msgs }] = await Promise.all([
    admin
      .from("maintenance_attachments")
      .select("id, kind, storage_path")
      .eq("parent_id", ticketId)
      .eq("parent_type", "ticket")
      .eq("tenant_id", row.tenant_id)
      .order("created_at", { ascending: true }),
    row.conversation_id
      ? admin
          .from("maintenance_messages")
          .select("role, content, created_at")
          .eq("conversation_id", row.conversation_id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ role: string; content: string; created_at: string }> }),
  ]);

  const attachments: MaintenanceTicketAttachment[] = [];
  for (const a of (atts ?? []) as Array<{ id: string; kind: string; storage_path: string }>) {
    const { data: signed } = await admin.storage
      .from("maintenance-media")
      .createSignedUrl(a.storage_path, 60 * 60);
    attachments.push({
      id: a.id,
      kind: a.kind as "image" | "video" | "audio",
      storage_path: a.storage_path,
      signed_url: signed?.signedUrl ?? null,
    });
  }

  const messages: MaintenanceTicketMessage[] = (msgs ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system")
    .map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      created_at: m.created_at,
    }));

  return { ...base, attachment_count: attachments.length, attachments, messages };
}
