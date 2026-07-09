// Build the DPS Create Tenancy request body from the registration-wizard
// input. Pure shape transform — auth comes separately from the tenant's
// connection (getDpsContext). Field names/lengths per the Create Tenancy
// design note §4.1.3; dates are ISO YYYY-MM-DD and money is a 2dp string,
// both verified against UAT (scripts/dps-uat-probe.mjs).
//
// Unlike the TDS payload, this body carries no secrets (auth is the Bearer
// header), so it can be persisted to dps_deposits.request_payload as-is.

import { sanitizeDpsText } from "./sanitize";
import type { RegisterDpsDepositInput, DpsTenantInput } from "@/features/dps/domain/deposit-types";

/** 2dp money string, e.g. 1000 → "1000.00" (matches the doc examples + probe). */
function money(value: number): string {
  return value.toFixed(2);
}

function omitEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined && v !== null)
  );
}

function clean(value: string | undefined | null): string {
  return value ? sanitizeDpsText(value) : "";
}

function buildTenant(t: DpsTenantInput): Record<string, unknown> {
  const mobile = (t.mobile ?? "").replace(/\s+/g, "");
  return omitEmpty({
    tenantReference: clean(t.tenantReference ?? ""),
    title: clean(t.title),
    firstName: clean(t.firstName),
    lastName: clean(t.lastName),
    emailAddress: t.email?.trim() ?? "",
    // Country code defaults to GB server-side when omitted; we only collect
    // UK mobiles in v1 (schema enforces the 07… format).
    mobileNumber: mobile,
  });
}

/**
 * Assemble the full Create Tenancy body. AgentLandlordId comes from the
 * tenant's dps_connections row (7-digit account number).
 */
export function buildCreateTenancyPayload(
  input: RegisterDpsDepositInput,
  agentLandlordId: string
): Record<string, unknown> {
  const p = input.property;
  const t = input.tenancy;

  const relevantPerson = input.relevantPerson
    ? omitEmpty({
        firstName: clean(input.relevantPerson.firstName),
        lastName: clean(input.relevantPerson.lastName),
        emailAddress: input.relevantPerson.email.trim(),
        companyName: clean(input.relevantPerson.companyName ?? ""),
        mobileNumber: (input.relevantPerson.mobile ?? "").replace(/\s+/g, ""),
      })
    : null;

  return {
    AgentLandlordId: Number(agentLandlordId),
    AddressLine1: clean(p.addressLine1),
    ...omitEmpty({
      AddressLine2: clean(p.addressLine2 ?? ""),
      AddressLine3: clean(p.addressLine3 ?? ""),
      County: clean(p.county ?? ""),
      PropertyType: p.propertyType,
      FurnishingType: p.furnishingType,
      NumberOfBedrooms: p.numberOfBedrooms,
      TenancyReference: clean(t.tenancyReference ?? ""),
    }),
    Town: clean(p.town),
    PostCode: p.postcode.trim().toUpperCase(),
    RentAmount: money(t.rentAmount),
    RentFrequency: t.rentFrequency,
    TenancyStartDate: t.startDate,
    TenancyLength: t.tenancyLengthMonths,
    DepositAmount: money(t.depositAmount),
    DatePaid: t.datePaid,
    Tenants: input.tenants.map(buildTenant),
    RelevantPerson: relevantPerson,
  };
}
