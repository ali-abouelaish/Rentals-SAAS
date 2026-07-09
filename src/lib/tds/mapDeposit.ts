// Build the TDS CreateDeposit request body from the registration-wizard input.
//
// The wizard already collects everything TDS needs (property address parts,
// tenancy dates, deposit amount + received date, and the people), so this is a
// pure shape transform. Auth/scheme identifiers come from the tenant's
// connection (see getTdsContext). See "api docs/TDS API.md" §3.

import type {
  RegisterTdsDepositInput,
  TdsLandlordInput,
  TdsPersonInput,
} from "@/features/tds/domain/deposit-types";

export type TdsPayloadAuth = {
  memberId: string;
  branchId: string;
  apiKey: string;
  region: string;
  schemeType: string;
};

// Person classifications recognised by TDS (see §3 "Person object").
const CLASS_LEAD = "Lead Tenant";
const CLASS_JOINT = "Joint Tenant";
const CLASS_RELATED = "Related Party";
const CLASS_LANDLORD = "Primary Landlord";

// Doc inconsistency: the field-table "Format" column says DD-MM-YYYY, while the
// examples (and the repayment endpoint) use DD/MM/YYYY. VERIFIED against the
// sandbox 2026-07-08 (scripts/tds-uat-probe.mjs): "-" fails CreateDepositStatus
// with "<date> is not a valid date" on every date field; "/" reaches status
// "created" and returns a DAN. So "/" is correct — do not change to "-".
export const TDS_DATE_SEPARATOR: "/" | "-" = "/";

/** yyyy-mm-dd (from an <input type="date">) → DD<sep>MM<sep>YYYY for TDS. */
export function formatTdsDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return [d, mo, y].join(TDS_DATE_SEPARATOR);
}

/** 2dp money value. TDS accepts numeric amounts between 0.00 and 999999.99. */
function money(value: number): number {
  return Number(value.toFixed(2));
}

function omitEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v != null));
}

function buildTenant(p: TdsPersonInput, classification: string): Record<string, unknown> {
  return omitEmpty({
    person_classification: classification,
    person_title: p.title,
    person_firstname: p.firstName,
    person_surname: p.surname,
    is_business: "N",
    person_email: p.email ?? "",
    person_mobile: p.mobile ?? "",
  });
}

function buildLandlord(l: TdsLandlordInput): Record<string, unknown> {
  return omitEmpty({
    person_classification: CLASS_LANDLORD,
    person_title: l.title,
    person_firstname: l.firstName,
    person_surname: l.surname,
    is_business: l.isBusiness ? "Y" : "N",
    business_name: l.isBusiness ? l.businessName ?? "" : "",
    // Landlord address is mandatory (tenant addresses are not).
    person_paon: l.paon,
    person_saon: l.saon ?? "",
    person_street: l.street,
    person_locality: l.locality ?? "",
    person_town: l.town,
    person_administrative_area: l.administrativeArea,
    person_postcode: l.postcode,
    person_country: l.country || "United Kingdom",
    person_email: l.email ?? "",
    person_mobile: l.mobile ?? "",
  });
}

/**
 * Assemble the full CreateDeposit body. The returned object still contains the
 * api_key — the caller (registerTdsDeposit) strips it via stripApiKey before
 * persisting request_payload.
 */
export function buildCreateDepositPayload(
  input: RegisterTdsDepositInput,
  auth: TdsPayloadAuth
): Record<string, unknown> {
  const people = [
    buildTenant(input.leadTenant, CLASS_LEAD),
    ...input.jointTenants.map((t) => buildTenant(t, CLASS_JOINT)),
    ...input.relatedParties.map((t) => buildTenant(t, CLASS_RELATED)),
    buildLandlord(input.landlord),
  ];

  // number_of_tenants must include related parties (guarantors), per §3.
  const numberOfTenants = 1 + input.jointTenants.length + input.relatedParties.length;

  const tenancy = omitEmpty({
    user_tenancy_reference: input.contractId,
    property_paon: input.property.paon,
    property_saon: input.property.saon ?? "",
    property_street: input.property.street,
    property_locality: input.property.locality ?? "",
    property_town: input.property.town,
    property_administrative_area: input.property.administrativeArea,
    property_postcode: input.property.postcode,
    furnished_status: input.property.furnishedStatus ?? "",
    tenancy_start_date: formatTdsDate(input.tenancy.startDate),
    tenancy_expected_end_date: formatTdsDate(input.tenancy.endDate),
    rent_amount: input.tenancy.rentAmount != null ? money(input.tenancy.rentAmount) : "",
    deposit_amount: money(input.tenancy.depositAmount),
    deposit_amount_to_protect: money(input.tenancy.depositAmount),
    deposit_received_date: formatTdsDate(input.tenancy.depositReceivedDate),
    number_of_tenants: numberOfTenants,
    number_of_landlords: 1,
    people,
  });

  return {
    member_id: auth.memberId,
    branch_id: auth.branchId,
    api_key: auth.apiKey,
    region: auth.region,
    scheme_type: auth.schemeType,
    tenancy: [tenancy],
  };
}

/** Remove the api_key before the payload is stored on the deposit row. */
export function stripApiKey(payload: Record<string, unknown>): Record<string, unknown> {
  const { api_key: _omit, ...rest } = payload;
  return rest;
}
