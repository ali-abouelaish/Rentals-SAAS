import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  daysInMonthUtc,
  expectedRent,
} from "@/features/contracts/domain/pro-rata";
import {
  ACTIVE_CONTRACT_STATUSES,
  type PortalDeposit,
  type PortalPayment,
  type PortalPmTenant,
  type PortalRentStatus,
  type PortalTenancy,
  type PortalTicket,
} from "../domain/types";

// All portal reads use the admin client (renters have no Supabase session,
// so RLS can't scope them). Every query MUST filter by tenant_id and, where
// the table carries it, pm_tenant_id — this double filter is the portal's
// entire tenant boundary.

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

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export async function getPortalPmTenant(
  tenantId: string,
  pmTenantId: string
): Promise<PortalPmTenant | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pm_tenants")
    .select("id, full_name, email")
    .eq("id", pmTenantId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    fullName: data.full_name as string,
    firstName: firstNameOf(data.full_name as string),
    email: data.email as string,
  };
}

const CONTRACT_SELECT = `
  id, status, start_date, expiry_date, rent_pcm, pro_rata_amount, collection_date,
  payment_reference, deposit, deposit_scheme, deposit_scheme_ref,
  deposit_protected_date, deposit_returned, deposit_returned_at,
  unit:units(
    id, unit_type, room_number, room_type,
    property:properties(id, name, address_line_1, address_line_2, area, postcode)
  )
`;

type RawPortalContract = {
  id: string;
  status: string;
  start_date: string;
  expiry_date: string | null;
  rent_pcm: number;
  pro_rata_amount: number | string | null;
  collection_date: number | null;
  payment_reference: string;
  deposit: number;
  deposit_scheme: "dps" | "mydeposits" | "tds" | "none";
  deposit_scheme_ref: string | null;
  deposit_protected_date: string | null;
  deposit_returned: boolean | null;
  deposit_returned_at: string | null;
  unit: {
    id: string;
    unit_type: string;
    room_number: string | null;
    room_type: string | null;
    property: {
      id: string;
      name: string;
      address_line_1: string;
      address_line_2: string | null;
      area: string | null;
      postcode: string | null;
    } | null;
  } | null;
};

export type PortalContractRow = {
  tenancy: PortalTenancy;
  raw: RawPortalContract;
};

function toTenancy(r: RawPortalContract, ended: boolean): PortalTenancy {
  return {
    contractId: r.id,
    status: r.status,
    ended,
    startDate: r.start_date,
    expiryDate: r.expiry_date ?? null,
    rentPcm: Number(r.rent_pcm ?? 0),
    collectionDate: r.collection_date ?? null,
    paymentReference: r.payment_reference,
    propertyName: r.unit?.property?.name ?? "Your home",
    propertyAddress: r.unit?.property
      ? buildAddress({
          address_line_1: r.unit.property.address_line_1,
          address_line_2: r.unit.property.address_line_2,
          postcode: r.unit.property.postcode,
          area: r.unit.property.area,
        })
      : "",
    unitLabel: r.unit
      ? buildUnitLabel({
          unit_type: r.unit.unit_type,
          room_number: r.unit.room_number,
          room_type: r.unit.room_type,
        })
      : "",
  };
}

/**
 * The renter's tenancies: all active contracts, or — when none — the most
 * recent terminated one (marked `ended`) so post-tenancy renters can still
 * see their deposit-return status.
 */
export async function getPortalContracts(
  tenantId: string,
  pmTenantId: string
): Promise<PortalContractRow[]> {
  const admin = createSupabaseAdminClient();

  const { data: active, error } = await admin
    .from("property_contracts")
    .select(CONTRACT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("pm_tenant_id", pmTenantId)
    .in("status", [...ACTIVE_CONTRACT_STATUSES])
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);

  const activeRows = (active ?? []) as unknown as RawPortalContract[];
  if (activeRows.length > 0) {
    return activeRows.map((r) => ({ tenancy: toTenancy(r, false), raw: r }));
  }

  const { data: ended, error: endedErr } = await admin
    .from("property_contracts")
    .select(CONTRACT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("pm_tenant_id", pmTenantId)
    .eq("status", "terminated")
    .order("start_date", { ascending: false })
    .limit(1);
  if (endedErr) throw new Error(endedErr.message);

  const endedRows = (ended ?? []) as unknown as RawPortalContract[];
  return endedRows.map((r) => ({ tenancy: toTenancy(r, true), raw: r }));
}

function nextDueDateIso(
  collectionDate: number | null,
  currentMonthPaid: boolean
): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const monthIndex0 = now.getUTCMonth() + (currentMonthPaid ? 1 : 0);
  const target = new Date(Date.UTC(year, monthIndex0, 1));
  const day = Math.min(
    collectionDate ?? 1,
    daysInMonthUtc(target.getUTCFullYear(), target.getUTCMonth())
  );
  target.setUTCDate(day);
  return target.toISOString().slice(0, 10);
}

/** Rent position for one active contract. Mirrors the staff Rent Collection
 *  math (src/features/rent-collection/data/queries.ts) so both surfaces agree. */
export async function getPortalRent(
  tenantId: string,
  contract: RawPortalContract
): Promise<PortalRentStatus> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("rent_payments")
    .select("period_year, period_month, amount, paid_at")
    .eq("tenant_id", tenantId)
    .eq("contract_id", contract.id)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });
  if (error) throw new Error(error.message);

  const payments: PortalPayment[] = (data ?? []).map((p) => ({
    periodYear: p.period_year as number,
    periodMonth: p.period_month as number,
    amount: Number(p.amount),
    paidAt: p.paid_at as string,
  }));

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const todayIso = now.toISOString().slice(0, 10);

  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const currentMonthPaid = payments.some(
    (p) => p.periodYear === currentYear && p.periodMonth === currentMonth
  );

  const rentPcm = Number(contract.rent_pcm ?? 0);
  const proRata =
    contract.pro_rata_amount == null ? null : Number(contract.pro_rata_amount);
  const expected = expectedRent(contract.start_date, todayIso, rentPcm, proRata);
  const arrears = Math.max(0, Math.round(expected - paid));

  return {
    expected: Math.round(expected),
    paid: Math.round(paid),
    arrears,
    currentMonthPaid,
    nextDueDate: nextDueDateIso(contract.collection_date, currentMonthPaid),
    payments,
  };
}

/** All of the renter's maintenance tickets, newest first. */
export async function getPortalTickets(
  tenantId: string,
  pmTenantId: string
): Promise<PortalTicket[]> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("maintenance_tickets")
    .select("id, reference, description, priority, status, created_at, resolved_at")
    .eq("tenant_id", tenantId)
    .eq("pm_tenant_id", pmTenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const tickets = data ?? [];

  // Staff comments on these tickets, shown to the renter as updates.
  const updatesByTicket = new Map<string, PortalTicket["updates"]>();
  if (tickets.length > 0) {
    const { data: comments, error: commentsErr } = await admin
      .from("maintenance_ticket_comments")
      .select("ticket_id, author_name, body, created_at")
      .eq("tenant_id", tenantId)
      .in("ticket_id", tickets.map((t) => t.id as string))
      .order("created_at", { ascending: true });
    if (commentsErr) throw new Error(commentsErr.message);

    for (const c of comments ?? []) {
      const list = updatesByTicket.get(c.ticket_id as string) ?? [];
      list.push({
        body: c.body as string,
        authorName: c.author_name as string,
        createdAt: c.created_at as string,
      });
      updatesByTicket.set(c.ticket_id as string, list);
    }
  }

  return tickets.map((t) => ({
    reference: t.reference as string,
    description: t.description as string,
    priority: t.priority as PortalTicket["priority"],
    status: t.status as string,
    createdAt: t.created_at as string,
    resolvedAt: (t.resolved_at as string | null) ?? null,
    updates: updatesByTicket.get(t.id as string) ?? [],
  }));
}

/** Deposit position for one contract, enriched from the scheme provider table. */
export async function getPortalDeposit(
  tenantId: string,
  contract: RawPortalContract
): Promise<PortalDeposit> {
  const admin = createSupabaseAdminClient();

  let certificateUrl: string | null = null;
  let dan: string | null = null;
  let dpsDepositId: string | null = null;
  let providerProtected = false;

  if (contract.deposit_scheme === "mydeposits") {
    const { data } = await admin
      .from("mydeposits_protections")
      .select("status, certificate_url")
      .eq("tenant_id", tenantId)
      .eq("contract_id", contract.id)
      .maybeSingle();
    certificateUrl = (data?.certificate_url as string | null) ?? null;
    providerProtected = data?.status === "protected";
  } else if (contract.deposit_scheme === "tds") {
    const { data } = await admin
      .from("tds_deposits")
      .select("status, dan")
      .eq("tenant_id", tenantId)
      .eq("contract_id", contract.id)
      .maybeSingle();
    dan = (data?.dan as string | null) ?? null;
    providerProtected = data?.status === "created";
  } else if (contract.deposit_scheme === "dps") {
    const { data } = await admin
      .from("dps_deposits")
      .select("status, deposit_id")
      .eq("tenant_id", tenantId)
      .eq("contract_id", contract.id)
      .maybeSingle();
    dpsDepositId = (data?.deposit_id as string | null) ?? null;
    providerProtected = data?.status === "protected";
  }

  const state: PortalDeposit["state"] =
    contract.deposit_scheme === "none"
      ? "none"
      : providerProtected || Boolean(contract.deposit_protected_date)
      ? "protected"
      : "pending";

  return {
    amount: Number(contract.deposit ?? 0),
    scheme: contract.deposit_scheme,
    state,
    schemeRef: contract.deposit_scheme_ref ?? null,
    protectedDate: contract.deposit_protected_date ?? null,
    certificateUrl,
    dan,
    dpsDepositId,
    returned: Boolean(contract.deposit_returned),
    returnedAt: contract.deposit_returned_at ?? null,
  };
}

/** The unit the renter currently occupies (units.pm_tenant_id backlink). */
export async function getPortalCurrentUnit(
  tenantId: string,
  pmTenantId: string
): Promise<{ unitId: string; propertyId: string } | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("units")
    .select("id, property_id")
    .eq("tenant_id", tenantId)
    .eq("pm_tenant_id", pmTenantId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { unitId: data.id as string, propertyId: data.property_id as string };
}

/**
 * Find the pm_tenant a login link should be issued for. Case-insensitive
 * exact email match; when several rows share the address, prefer one holding
 * an active contract, then the most recently created.
 */
export async function findPmTenantForLogin(
  tenantId: string,
  email: string
): Promise<{ id: string; fullName: string; email: string } | null> {
  const emailLower = email.trim().toLowerCase();
  if (!emailLower) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pm_tenants")
    .select("id, full_name, email, created_at")
    .eq("tenant_id", tenantId)
    .ilike("email", emailLower.replace(/([%_\\])/g, "\\$1"));
  if (error) throw new Error(error.message);

  const matches = (data ?? []).filter(
    (r) => (r.email as string).trim().toLowerCase() === emailLower
  );
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    const { data: contracts } = await admin
      .from("property_contracts")
      .select("pm_tenant_id")
      .eq("tenant_id", tenantId)
      .in("pm_tenant_id", matches.map((m) => m.id as string))
      .in("status", [...ACTIVE_CONTRACT_STATUSES]);
    const withActive = new Set((contracts ?? []).map((c) => c.pm_tenant_id as string));
    matches.sort((a, b) => {
      const activeDiff =
        Number(withActive.has(b.id as string)) - Number(withActive.has(a.id as string));
      if (activeDiff !== 0) return activeDiff;
      return (b.created_at as string).localeCompare(a.created_at as string);
    });
  }

  const row = matches[0];
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    email: row.email as string,
  };
}

export async function updateLastPortalLogin(
  tenantId: string,
  pmTenantId: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("pm_tenants")
    .update({ last_portal_login_at: new Date().toISOString() })
    .eq("id", pmTenantId)
    .eq("tenant_id", tenantId);
}

export async function markPortalInvited(
  tenantId: string,
  pmTenantId: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("pm_tenants")
    .update({ portal_invited_at: new Date().toISOString() })
    .eq("id", pmTenantId)
    .eq("tenant_id", tenantId);
}
