import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  KeyAssignment,
  KeyGroup,
  KeyHolder,
  KeyWithCurrent,
  KeysOutItem,
  PropertyKeysPayload,
} from "../domain/types";

type KeyRow = {
  id: string;
  set_name: string;
  copy_label: string;
  status: KeyWithCurrent["status"];
  notes: string | null;
  property_id: string | null;
  unit_id: string | null;
  unit: {
    id: string;
    room_number: string | null;
    unit_type: string;
  } | null;
};

type AssignmentRow = {
  id: string;
  key_id: string;
  held_by_user_id: string | null;
  held_by_contact_name: string | null;
  held_by_contact_phone: string | null;
  purpose: KeyAssignment["purpose"];
  notes: string | null;
  checked_out_at: string;
  expected_return_at: string | null;
  returned_at: string | null;
  returned_condition: KeyAssignment["returnedCondition"];
  holder?: { id: string; display_name: string | null } | null;
};

function unitLabel(unit: KeyRow["unit"]): string | null {
  if (!unit) return null;
  if (unit.room_number) return `Room ${unit.room_number}`;
  if (unit.unit_type === "studio") return "Studio";
  if (unit.unit_type === "whole_flat") return "Whole flat";
  return unit.unit_type.replace(/_/g, " ");
}

function buildHolder(row: AssignmentRow): KeyHolder {
  if (row.held_by_user_id) {
    return {
      kind: "user",
      userId: row.held_by_user_id,
      name: row.holder?.display_name ?? null,
    };
  }
  return {
    kind: "contact",
    name: row.held_by_contact_name ?? "",
    phone: row.held_by_contact_phone ?? null,
  };
}

function isOverdue(row: AssignmentRow): boolean {
  if (row.returned_at) return false;
  if (!row.expected_return_at) return false;
  return new Date(row.expected_return_at).getTime() < Date.now();
}

function toAssignment(row: AssignmentRow): KeyAssignment {
  return {
    id: row.id,
    keyId: row.key_id,
    heldBy: buildHolder(row),
    purpose: row.purpose,
    notes: row.notes,
    checkedOutAt: row.checked_out_at,
    expectedReturnAt: row.expected_return_at,
    returnedAt: row.returned_at,
    returnedCondition: row.returned_condition,
    isOverdue: isOverdue(row),
  };
}

export async function getPropertyKeys(propertyId: string): Promise<PropertyKeysPayload | null> {
  const supabase = createSupabaseServerClient();

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id, address_line_1, name")
    .eq("id", propertyId)
    .maybeSingle();

  if (propErr) throw new Error(propErr.message);
  if (!property) return null;

  // Pull every key linked to the property either directly OR via one of
  // its units. We do it in one query by joining units and filtering on
  // property_id at either level.
  const { data: directKeys, error: directErr } = await supabase
    .from("keys")
    .select(
      "id, set_name, copy_label, status, notes, property_id, unit_id, unit:unit_id(id, room_number, unit_type, property_id)"
    )
    .eq("property_id", propertyId);

  if (directErr) throw new Error(directErr.message);

  const { data: unitKeys, error: unitErr } = await supabase
    .from("keys")
    .select(
      "id, set_name, copy_label, status, notes, property_id, unit_id, unit:unit_id!inner(id, room_number, unit_type, property_id)"
    )
    .is("property_id", null)
    .eq("unit.property_id", propertyId);

  if (unitErr) throw new Error(unitErr.message);

  const merged = [...(directKeys ?? []), ...(unitKeys ?? [])];
  // Deduplicate (a key with both property_id and unit_id set would otherwise
  // appear once per query).
  const seen = new Set<string>();
  const keyRows: KeyRow[] = [];
  for (const row of merged as unknown as KeyRow[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    keyRows.push(row);
  }

  if (keyRows.length === 0) {
    return {
      property: {
        id: property.id,
        address: property.address_line_1 ?? property.name ?? "Property",
      },
      groups: [],
      totals: { registered: 0, out: 0 },
    };
  }

  const keyIds = keyRows.map((k) => k.id);
  const { data: openAssignments, error: aErr } = await supabase
    .from("key_assignments")
    .select(
      "id, key_id, held_by_user_id, held_by_contact_name, held_by_contact_phone, purpose, notes, checked_out_at, expected_return_at, returned_at, returned_condition, holder:held_by_user_id(id, display_name)"
    )
    .in("key_id", keyIds)
    .is("returned_at", null);

  if (aErr) throw new Error(aErr.message);

  const currentByKey = new Map<string, KeyAssignment>();
  for (const row of (openAssignments ?? []) as unknown as AssignmentRow[]) {
    currentByKey.set(row.key_id, toAssignment(row));
  }

  const keysWithCurrent: KeyWithCurrent[] = keyRows.map((row) => ({
    id: row.id,
    setName: row.set_name,
    copyLabel: row.copy_label,
    status: row.status,
    notes: row.notes,
    unitId: row.unit_id,
    unitLabel: unitLabel(row.unit),
    currentAssignment: currentByKey.get(row.id) ?? null,
  }));

  // Group by (unitLabel, setName). Property-level sets render first.
  const groupKey = (k: KeyWithCurrent) => `${k.unitId ?? ""}::${k.setName}`;
  const groupMap = new Map<string, KeyGroup>();
  for (const k of keysWithCurrent) {
    const key = groupKey(k);
    let group = groupMap.get(key);
    if (!group) {
      group = {
        setName: k.setName,
        unitId: k.unitId,
        unitLabel: k.unitLabel,
        keys: [],
      };
      groupMap.set(key, group);
    }
    group.keys.push(k);
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    // property-level (no unit) groups first
    if (a.unitId === null && b.unitId !== null) return -1;
    if (a.unitId !== null && b.unitId === null) return 1;
    const u = (a.unitLabel ?? "").localeCompare(b.unitLabel ?? "");
    if (u !== 0) return u;
    return a.setName.localeCompare(b.setName);
  });

  for (const g of groups) {
    g.keys.sort((a, b) => a.copyLabel.localeCompare(b.copyLabel));
  }

  const out = keysWithCurrent.filter((k) => k.status === "loaned").length;

  return {
    property: {
      id: property.id,
      address: property.address_line_1 ?? property.name ?? "Property",
    },
    groups,
    totals: { registered: keysWithCurrent.length, out },
  };
}

export async function getKeyHistory(keyId: string): Promise<KeyAssignment[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("key_assignments")
    .select(
      "id, key_id, held_by_user_id, held_by_contact_name, held_by_contact_phone, purpose, notes, checked_out_at, expected_return_at, returned_at, returned_condition, holder:held_by_user_id(id, display_name)"
    )
    .eq("key_id", keyId)
    .order("checked_out_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as AssignmentRow[]).map(toAssignment);
}

export async function getKeysOutForTenant(tenantId: string): Promise<KeysOutItem[]> {
  const supabase = createSupabaseServerClient();

  // Currently-out keys = key.status = 'loaned' AND a row in key_assignments
  // with returned_at IS NULL. We start from the open assignment so the
  // overdue / holder data is colocated.
  const { data, error } = await supabase
    .from("key_assignments")
    .select(
      `
        id, key_id, held_by_user_id, held_by_contact_name, held_by_contact_phone,
        purpose, notes, checked_out_at, expected_return_at, returned_at, returned_condition,
        holder:held_by_user_id(id, display_name),
        key:key_id!inner(
          id, set_name, copy_label, status, property_id, unit_id,
          property:property_id(id, address_line_1, name),
          unit:unit_id(id, room_number, unit_type, property_id, property:property_id(id, address_line_1, name))
        )
      `
    )
    .eq("tenant_id", tenantId)
    .is("returned_at", null)
    .eq("key.status", "loaned")
    .order("checked_out_at", { ascending: false });

  if (error) throw new Error(error.message);

  type Row = AssignmentRow & {
    key: {
      id: string;
      set_name: string;
      copy_label: string;
      status: KeyWithCurrent["status"];
      property_id: string | null;
      unit_id: string | null;
      property: { id: string; address_line_1: string | null; name: string | null } | null;
      unit:
        | {
            id: string;
            room_number: string | null;
            unit_type: string;
            property_id: string | null;
            property: { id: string; address_line_1: string | null; name: string | null } | null;
          }
        | null;
    };
  };

  const items: KeysOutItem[] = ((data ?? []) as unknown as Row[]).map((row) => {
    const property =
      row.key.property ??
      row.key.unit?.property ??
      null;
    const propId = property?.id ?? row.key.property_id ?? row.key.unit?.property_id ?? "";
    const address =
      property?.address_line_1 ?? property?.name ?? "Property";

    return {
      key: {
        id: row.key.id,
        setName: row.key.set_name,
        copyLabel: row.key.copy_label,
        status: row.key.status,
      },
      property: { id: propId, address },
      unitLabel: unitLabel(
        row.key.unit
          ? {
              id: row.key.unit.id,
              room_number: row.key.unit.room_number,
              unit_type: row.key.unit.unit_type,
            }
          : null
      ),
      heldBy: buildHolder(row),
      purpose: row.purpose,
      checkedOutAt: row.checked_out_at,
      expectedReturnAt: row.expected_return_at,
      isOverdue: isOverdue(row),
    };
  });

  // Overdue first, then most-recently-checked-out.
  items.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return new Date(b.checkedOutAt).getTime() - new Date(a.checkedOutAt).getTime();
  });

  return items;
}

export async function getInternalAgentsForTenant(
  tenantId: string
): Promise<Array<{ id: string; name: string }>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, role")
    .eq("tenant_id", tenantId)
    .order("display_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.display_name ?? "Unnamed",
  }));
}
