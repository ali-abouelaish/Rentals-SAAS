import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProperties, getPropertyById } from "@/features/properties/data/properties";
import { getUnits, getUnitsByProperty } from "@/features/properties/data/units";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { getOwnerLandlords } from "@/features/properties/data/landlords";
import {
  getPmTenants,
  getPmTenantById,
  getPmTenantContractHistory,
} from "@/features/pm-tenants/data/pm-tenants";
import { getContracts, getContractById } from "@/features/contracts/data/contracts";
import { getRentCollectionRows } from "@/features/rent-collection/data/queries";
import { getFinanceRollup } from "@/features/finances/data/queries";
import { listTenantCharges } from "@/features/finances/data/tenant-charges";
import { getCloseInfoForMonth } from "@/features/finances/data/closes";
import { getBookings, getBookingById } from "@/features/bookings/data/bookings";
import { getLeads, getLeadStats } from "@/features/leads/data/leads";
import type { ToolName } from "../domain/tools";

const MAX_ROWS = 20;

/** pence → GBP (pounds), rounded to 2dp. */
function gbp(pence: number | null | undefined): number {
  return Math.round(Number(pence ?? 0)) / 100;
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function asNum(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}
function asStrArr(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v.filter((x): x is string => typeof x === "string");
  return arr.length ? arr : undefined;
}

type Args = Record<string, unknown>;
/* eslint-disable @typescript-eslint/no-explicit-any */

function unitLabel(u: any): string {
  if (u?.unit_type === "room") return u.room_number ? `Room ${u.room_number}` : "Room";
  return u?.unit_type === "studio" ? "Studio" : "Whole flat";
}

function slimUnit(u: any) {
  return {
    id: u.id,
    unitType: u.unit_type,
    label: unitLabel(u),
    roomNumber: u.room_number ?? null,
    roomType: u.room_type ?? null,
    status: u.status,
    availableDate: u.available_date ?? null,
    minPriceGbp: u.min_price_pcm ?? null,
    maxPriceGbp: u.max_price_pcm ?? null,
    depositGbp: u.deposit ?? null,
    propertyId: u.property_id,
    propertyName: u.property?.name ?? null,
    propertyAddress: u.property?.address_line_1 ?? null,
    portfolioName: u.property?.portfolio?.name ?? null,
    occupantName: u.pm_tenant?.full_name ?? null,
  };
}

function slimProperty(p: any) {
  return {
    id: p.id,
    name: p.name,
    propertyType: p.property_type,
    address: [p.address_line_1, p.address_line_2, p.area, p.postcode].filter(Boolean).join(", "),
    area: p.area ?? null,
    postcode: p.postcode ?? null,
    totalRooms: p.total_rooms ?? null,
    portfolioName: p.portfolio?.name ?? null,
    ownerLandlordName: p.owner_landlord?.name ?? null,
  };
}

function slimContract(c: any) {
  return {
    id: c.id,
    status: c.status,
    startDate: c.start_date,
    rentPcmGbp: c.rent_pcm ?? null,
    depositGbp: c.deposit ?? null,
    collectionDate: c.collection_date ?? null,
    depositScheme: c.deposit_scheme ?? null,
    depositProtected: !!c.deposit_protected_date,
    depositProtectedDate: c.deposit_protected_date ?? null,
    noticeGivenDate: c.notice_given_date ?? null,
    vacateDate: c.vacate_date ?? null,
    tenantName: c.pm_tenant?.full_name ?? null,
    tenantId: c.pm_tenant?.id ?? c.pm_tenant_id ?? null,
    propertyName: c.unit?.property?.name ?? null,
    propertyId: c.unit?.property?.id ?? null,
    unitLabel: c.unit ? unitLabel(c.unit) : null,
  };
}

function slimPmTenant(t: any) {
  return {
    id: t.id,
    fullName: t.full_name,
    email: t.email ?? null,
    phone: t.phone ?? null,
    employmentStatus: t.employment_status ?? null,
    rightToRentVerified: t.right_to_rent_verified ?? null,
    currentUnitLabel: t.current_unit ? unitLabel(t.current_unit) : null,
    currentPropertyName: t.current_unit?.property?.name ?? null,
    currentContract: t.current_contract
      ? {
          status: t.current_contract.status,
          startDate: t.current_contract.start_date,
          rentPcmGbp: t.current_contract.rent_pcm ?? null,
          depositProtected: !!t.current_contract.deposit_protected_date,
        }
      : null,
    guarantorCount: Array.isArray(t.guarantors) ? t.guarantors.length : 0,
  };
}

function slimBooking(b: any) {
  return {
    id: b.id,
    status: b.status,
    applicantName: b.applicant_name,
    applicantEmail: b.applicant_email ?? null,
    applicantPhone: b.applicant_phone ?? null,
    submittedAt: b.submitted_at ?? null,
    propertyName: b.unit?.property?.name ?? null,
    unitLabel: b.unit ? unitLabel(b.unit) : null,
  };
}

function slimLead(l: any) {
  return {
    id: l.id,
    name: l.name ?? null,
    email: l.email ?? null,
    telephone: l.telephone ?? null,
    status: l.status ?? null,
    source: l.source ?? null,
    propertyRef: l.property_ref ?? null,
    isHot: l.is_hot ?? null,
    createdAt: l.created_at ?? null,
    assignedAgent: l.assigned_agent?.display_name ?? null,
  };
}

function cap<T>(rows: T[], total?: number) {
  const sliced = rows.slice(0, MAX_ROWS);
  const realTotal = total ?? rows.length;
  return { count: sliced.length, total: realTotal, truncated: realTotal > sliced.length, rows: sliced };
}

/**
 * Tool name → wrapper. Each wrapper calls an existing tenant-scoped data
 * function (RLS isolates the tenant) and returns a small, GBP-normalised shape.
 */
export const DISPATCH: Record<ToolName, (args: Args) => Promise<unknown>> = {
  // ── Properties & units ──
  list_properties: async (a) => {
    const props = await getProperties({ portfolioId: asStr(a.portfolioId), area: asStr(a.area) });
    return cap(props.map(slimProperty));
  },
  get_property: async (a) => {
    const id = asStr(a.id);
    if (!id) return { error: "id is required" };
    const p = await getPropertyById(id);
    return p ? slimProperty(p) : { error: "not_found" };
  },
  list_units: async (a) => {
    const page = asNum(a.page) ?? 1;
    const res = await getUnits(
      {
        search: asStr(a.search),
        statuses: asStrArr(a.statuses) as any,
        unitTypes: asStrArr(a.unitTypes) as any,
        roomTypes: asStrArr(a.roomTypes) as any,
        availableFrom: asStr(a.availableFrom),
        availableTo: asStr(a.availableTo),
        minPrice: asNum(a.minPrice) != null ? String(asNum(a.minPrice)) : undefined,
        maxPrice: asNum(a.maxPrice) != null ? String(asNum(a.maxPrice)) : undefined,
      },
      page,
      MAX_ROWS
    );
    return { ...cap(res.units.map(slimUnit), res.total), page: res.page, totalPages: res.totalPages };
  },
  get_units_by_property: async (a) => {
    const propertyId = asStr(a.propertyId);
    if (!propertyId) return { error: "propertyId is required" };
    const units = await getUnitsByProperty(propertyId);
    return cap(units.map(slimUnit));
  },
  get_occupancy_snapshot: async () => {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from("units").select("status");
    if (error) return { error: error.message };
    const rows = (data ?? []) as { status: string }[];
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const total = rows.length;
    const occupied = byStatus["occupied"] ?? 0;
    const vacant = (byStatus["available"] ?? 0) + (byStatus["on_hold"] ?? 0);
    return {
      totalUnits: total,
      occupied,
      vacant,
      occupancyRate: total ? Math.round((occupied / total) * 1000) / 10 : 0,
      byStatus,
    };
  },
  list_portfolios: async () => {
    const ports = await getPortfolios();
    return cap(ports.map((p) => ({ id: (p as any).id, name: (p as any).name, color: (p as any).color })));
  },
  list_owner_landlords: async () => {
    const lls = await getOwnerLandlords();
    return cap(
      lls.map((l: any) => ({
        id: l.id,
        name: l.name,
        email: l.email ?? null,
        phone: l.phone ?? null,
        monthlyRentOwedGbp: l.monthly_rent_owed ?? null,
        paymentSchedule: l.payment_schedule ?? null,
        contractExpiry: l.contract_expiry_date ?? null,
      }))
    );
  },

  // ── pm_tenants & contracts ──
  list_pm_tenants: async (a) => {
    const ts = await getPmTenants({ search: asStr(a.search) });
    return cap(ts.map(slimPmTenant));
  },
  get_pm_tenant: async (a) => {
    const id = asStr(a.id);
    if (!id) return { error: "id is required" };
    const t = await getPmTenantById(id);
    return t ? slimPmTenant(t) : { error: "not_found" };
  },
  get_pm_tenant_contract_history: async (a) => {
    const pmTenantId = asStr(a.pmTenantId);
    if (!pmTenantId) return { error: "pmTenantId is required" };
    const rows = await getPmTenantContractHistory(pmTenantId);
    return cap((rows as any[]).map(slimContract));
  },
  list_contracts: async (a) => {
    const rows = await getContracts({
      status: asStr(a.status) as any,
      depositProtected: asStr(a.depositProtected) as any,
      portfolioId: asStr(a.portfolioId),
      search: asStr(a.search),
    });
    return cap(rows.map(slimContract));
  },
  get_contract: async (a) => {
    const id = asStr(a.id);
    if (!id) return { error: "id is required" };
    const c = await getContractById(id);
    return c ? slimContract(c) : { error: "not_found" };
  },

  // ── Rent & finances ──
  get_arrears_summary: async () => {
    const rows = await getRentCollectionRows();
    const inArrears = rows.filter((r) => r.arrears > 0);
    const totalArrearsGbp = inArrears.reduce((s, r) => s + r.arrears, 0);
    const top = [...inArrears]
      .sort((x, y) => y.arrears - x.arrears)
      .slice(0, 10)
      .map((r) => ({
        tenantName: r.tenant.name,
        tenantId: r.tenant.id ?? null,
        propertyName: r.property.name,
        propertyId: r.property.id || null,
        unitLabel: r.unit.roomNumber ? `Room ${r.unit.roomNumber}` : r.unit.unitType,
        arrearsGbp: r.arrears,
        currentMonthPaid: r.currentMonthPaid,
        lastPaidAt: r.lastPaidAt,
      }));
    return {
      activeTenancies: rows.length,
      tenanciesInArrears: inArrears.length,
      totalArrearsGbp,
      topByArrears: top,
    };
  },
  get_rent_collection: async () => {
    const rows = await getRentCollectionRows();
    const sorted = [...rows].sort((x, y) => y.arrears - x.arrears);
    const slim = sorted.map((r) => ({
      tenantName: r.tenant.name,
      tenantId: r.tenant.id ?? null,
      propertyName: r.property.name,
      propertyId: r.property.id || null,
      unitLabel: r.unit.roomNumber ? `Room ${r.unit.roomNumber}` : r.unit.unitType,
      rentPcmGbp: r.rentPcm,
      expectedToDateGbp: r.expected,
      paidToDateGbp: r.paid,
      arrearsGbp: r.arrears,
      currentMonthPaid: r.currentMonthPaid,
      lastPaidAt: r.lastPaidAt,
    }));
    return cap(slim, rows.length);
  },
  get_finance_rollup: async (a) => {
    const year = asNum(a.year);
    const month = asNum(a.month);
    if (year == null || month == null) return { error: "year and month are required" };
    const r = await getFinanceRollup(year, month);
    return {
      monthLabel: r.month_label,
      isCurrentMonth: r.is_current_month,
      rentExpectedGbp: gbp(r.rent_expected),
      rentReceivedGbp: gbp(r.rent_received),
      rentOutstandingGbp: gbp(r.rent_outstanding),
      tenantChargesExpectedGbp: gbp(r.tenant_charges_expected),
      propertyCostsGbp: gbp(r.property_costs),
      ownerRentGbp: gbp(r.owner_rent),
      adminOverheadsGbp: gbp(r.admin_overheads),
      totalCostsGbp: gbp(r.total_costs),
      vacancyLossGbp: gbp(r.vacancy_loss),
      netProfitGbp: gbp(r.net_profit),
      byPortfolio: r.by_portfolio.map((p) => ({
        portfolioName: p.portfolio_name,
        rentReceivedGbp: gbp(p.rent_received),
        propertyCostsGbp: gbp(p.property_costs),
        ownerRentGbp: gbp(p.owner_rent),
        netProfitGbp: gbp(p.net_profit),
      })),
      // Per-property P&L, sorted by net profit descending (most profitable first,
      // biggest loss last). Use this for "which property is most/least profitable".
      byProperty: r.by_property.map((p) => ({
        propertyId: p.property_id,
        propertyName: p.property_name,
        portfolioName: p.portfolio_name,
        rentExpectedGbp: gbp(p.rent_expected),
        rentReceivedGbp: gbp(p.rent_received),
        propertyCostsGbp: gbp(p.property_costs),
        ownerRentGbp: gbp(p.owner_rent),
        netProfitGbp: gbp(p.net_profit),
      })),
    };
  },
  list_tenant_charges: async () => {
    const rows = await listTenantCharges();
    const slim = rows.map((c: any) => ({
      label: c.label,
      chargeType: c.charge_type,
      amountGbp: gbp(c.amount),
      recurrenceDay: c.recurrence_day ?? null,
      isActive: c.is_active,
      tenantName: c.context?.tenant_name ?? null,
      propertyName: c.context?.property_name ?? null,
      unitLabel: c.context?.unit_label ?? null,
    }));
    return cap(slim);
  },
  get_month_close_status: async (a) => {
    const year = asNum(a.year);
    const month = asNum(a.month);
    if (year == null || month == null) return { error: "year and month are required" };
    const info = await getCloseInfoForMonth(year, month);
    return { year, month, status: info.status, closedAt: info.closed_at, closedBy: info.closed_by_name };
  },

  // ── Bookings & leads ──
  list_bookings: async (a) => {
    const rows = await getBookings({
      status: asStr(a.status) as any,
      dateFrom: asStr(a.dateFrom),
      dateTo: asStr(a.dateTo),
      search: asStr(a.search),
    });
    return cap(rows.map(slimBooking));
  },
  get_booking: async (a) => {
    const id = asStr(a.id);
    if (!id) return { error: "id is required" };
    const b = await getBookingById(id);
    if (!b) return { error: "not_found" };
    const full = slimBooking(b);
    const responses = Array.isArray((b as any).form_responses)
      ? (b as any).form_responses.map((r: any) => ({
          question: r.question?.question_text ?? null,
          answer: r.answer_text ?? r.answer_file_url ?? null,
        }))
      : [];
    return { ...full, responses };
  },
  list_leads: async (a) => {
    const res = await getLeads({
      search: asStr(a.search),
      status: asStr(a.status),
      source: asStr(a.source),
      page: asNum(a.page) ?? 1,
    });
    return {
      ...cap(res.leads.map(slimLead), res.total),
      page: res.page,
      totalPages: res.totalPages,
    };
  },
  get_lead_stats: async () => {
    const s = await getLeadStats();
    return { receivedToday: s.todayCount, totalNew: s.totalNew, lastLeadAt: s.lastLeadAt };
  },
};
