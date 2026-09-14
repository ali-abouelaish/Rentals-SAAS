// RealityStone service: properties, tenancies, deposits, payments, certificates.
//
// Every path and request body below was verified live against the mydeposits
// sandbox on 2026-08-21 with a real bearer token — they are no longer guesses.
// Route existence is distinguishable from a missing entity by the 404 body:
// an empty body means the route exists and the id wasn't found; a
// `{"statusCode":404,"message":"Resource not found"}` envelope means the
// gateway matched no route at all.

import { mdFetch, type MdContext } from "./apiClient";
import { MD_API_VERSION, MD_SERVICE } from "./config";
import {
  zProperty,
  zTenancy,
  zDepositAmount,
  zDeposit,
  zPayment,
  zPaymentDetails,
  pickId,
  type MdDeposit,
  type MdPayment,
} from "./schemas";

const RS = `${MD_SERVICE.realityStone}/${MD_API_VERSION}`;

/**
 * Tenant on a tenancy. Field names confirmed against
 * `CreateTenancyTenantModel`: the lead flag is `isLeadTenant` (not `isLead`),
 * and the name is split — there is no `fullName`.
 */
export type TenancyTenant = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  dob?: string | null;
  isLeadTenant: boolean;
};

/** Landlord identity required by both the invite check and property creation. */
export type MdLandlord = {
  email: string;
  firstName: string;
  lastName: string;
  /** E.164, e.g. "+447700900123". Required — the API rejects a null phone. */
  phone: string;
};

/**
 * Pre-flight check before inviting a landlord to a property.
 *
 * PUT (not GET) and it takes the whole landlord object — the old
 * `GET /landlords/can-be-invited?email=` route does not exist; the gateway
 * bound "can-be-invited" as a `{landlordId}` segment and 400'd.
 * Returns 200 with no body when the landlord is invitable.
 */
export async function canLandlordBeInvited(
  ctx: MdContext,
  landlord: MdLandlord,
  officeId: number,
  opts: { inviteAsPropertyManager?: boolean } = {},
  protectionId?: string
): Promise<{ canBeInvited: boolean }> {
  try {
    await mdFetch<unknown>(ctx, `${RS}/properties/can-landlord-be-invited`, {
      method: "PUT",
      body: JSON.stringify({
        ...landlord,
        officeId,
        inviteAsPropertyManager: opts.inviteAsPropertyManager ?? false,
      }),
      protectionId,
    });
    return { canBeInvited: true };
  } catch {
    // A 400 here is a definitive "no" (deactivated account, wrong account type,
    // duplicate email …), not a transport failure worth surfacing separately.
    return { canBeInvited: false };
  }
}

/** Address shape the API expects — `country`/`region` are objects, not ids. */
export type MdAddress = {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postcode: string;
  country: { id: number; iso: string; text: string };
  region?: { id: number; text: string } | null;
  /** true when typed in by hand rather than picked from the postcode lookup. */
  isAddressSetManually: boolean;
};

/**
 * Create a property the agency manages on a landlord's behalf, inviting the
 * landlord in the same call.
 *
 * Route is `properties/manage-by-agency` — `properties/add-by-agency` (our old
 * path) 404s, and plain `POST /properties` is the landlord-role route and 403s
 * for an agent token.
 */
export async function addPropertyByAgency(
  ctx: MdContext,
  body: {
    officeId: number;
    name: string;
    /** From `look-up/property-types`; 1 = "other" is the safe default. */
    propertyTypeId: number;
    landlord: MdLandlord;
    address: MdAddress;
  },
  protectionId?: string
): Promise<{ propertyId: string | null; isLandlordInvited: boolean }> {
  const raw = await mdFetch<Record<string, unknown>>(ctx, `${RS}/properties/manage-by-agency`, {
    method: "POST",
    body: JSON.stringify(body),
    protectionId,
  });
  const parsed = zProperty.parse(raw);
  return {
    propertyId: pickId(raw, "propertyId", "id"),
    isLandlordInvited: parsed.isLandlordInvited ?? false,
  };
}

/**
 * ⚠ UPSTREAM BLOCKER (sandbox, 2026-08-21): this endpoint returns HTTP 500 with
 * an empty body for every request shape tried, including the minimal
 * `{propertyId, tenancyName}`. So does its sibling
 * `POST /tenants/can-be-invited-to-tenancy`. Binding and field validation both
 * pass first (a malformed body returns a proper 400), so the 500 happens after
 * validation — it is a mydeposits-side fault, not a payload problem. Property
 * creation against the same account and token succeeds. Reported to mydeposits.
 *
 * The body below is the shape their validators accept. Note `tenancyName` (not
 * `name`) and `isLeadTenant` (not `isLead`) — both confirmed via
 * `POST /tenancies/name/validate` and the tenant model's binding error.
 */
export async function createTenancy(
  ctx: MdContext,
  body: {
    propertyId: string | number;
    tenancyName: string;
    /** ISO 8601. */
    startDate: string;
    endDate?: string | null;
    rent: number;
    /** From `look-up/rent-frequencies`: 1 weekly, 2 monthly, 3 annually, 4 quarterly, 5 six-monthly. */
    rentFrequencyId: number;
    tenants: TenancyTenant[];
    interestedParties?: unknown[];
  },
  protectionId?: string
): Promise<{ tenancyId: string | null }> {
  const raw = await mdFetch<Record<string, unknown>>(ctx, `${RS}/tenancies`, {
    method: "POST",
    body: JSON.stringify({ interestedParties: [], ...body }),
    protectionId,
  });
  zTenancy.parse(raw);
  return { tenancyId: pickId(raw, "tenancyId", "id") };
}

/**
 * Scheme-calculated deposit cap for a rent + frequency.
 *
 * Takes query params and is NOT tenancy-scoped — the old
 * `/tenancies/{tenancyId}/deposit-amount` path does not exist. The response
 * field is `calculatedAmount`.
 */
export async function getDepositAmount(
  ctx: MdContext,
  args: { rent: number; rentFrequencyId: number },
  protectionId?: string
): Promise<number | null> {
  const qs = new URLSearchParams({
    rent: String(args.rent),
    rentFrequencyId: String(args.rentFrequencyId),
  });
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${RS}/tenancies/deposit-amount?${qs.toString()}`,
    { protectionId }
  );
  return zDepositAmount.parse(raw).calculatedAmount ?? null;
}

/** Schemes this tenancy may protect into — `schemeId` for createDeposit. */
export async function getAvailableDepositSchemes(
  ctx: MdContext,
  tenancyId: string,
  protectionId?: string
): Promise<Array<{ id: number; text: string }>> {
  const raw = await mdFetch<unknown>(
    ctx,
    `${RS}/tenancies/${encodeURIComponent(tenancyId)}/available-deposit-schemes`,
    { protectionId }
  );
  return Array.isArray(raw) ? (raw as Array<{ id: number; text: string }>) : [];
}

/**
 * `tenancyId` and `schemeId` are both required (confirmed by the binding
 * error on `CreateDeposit+Request`). `schemeId` must be one returned by
 * getAvailableDepositSchemes for that tenancy — an arbitrary id fails with
 * `MustBeAvailableScheme: Scheme is not available for region`.
 */
export async function createDeposit(
  ctx: MdContext,
  body: { tenancyId: string; schemeId: number; amount?: number },
  protectionId?: string
): Promise<{ depositId: string | null; status: string | null }> {
  const raw = await mdFetch<Record<string, unknown>>(ctx, `${RS}/deposits`, {
    method: "POST",
    body: JSON.stringify(body),
    protectionId,
  });
  const parsed = zDeposit.parse(raw);
  return {
    depositId: pickId(raw, "depositId", "id"),
    status: parsed.depositStatus ?? parsed.status ?? null,
  };
}

export async function getDeposit(
  ctx: MdContext,
  depositId: string,
  protectionId?: string
): Promise<MdDeposit> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${RS}/deposits/${encodeURIComponent(depositId)}`,
    { protectionId }
  );
  return zDeposit.parse(raw);
}

export async function getDepositCertificate(
  ctx: MdContext,
  depositId: string,
  protectionId?: string
): Promise<ArrayBuffer> {
  const res = await mdFetch<Response>(
    ctx,
    `${RS}/deposits/${encodeURIComponent(depositId)}/certificate`,
    { protectionId, raw: true }
  );
  return res.arrayBuffer();
}

/**
 * Lodge a payment against a deposit.
 * Path is deposit-scoped: `/deposits/{depositId}/payments`. Our old
 * `/deposits/payments` route does not exist.
 */
export async function createDepositPayment(
  ctx: MdContext,
  body: { depositId: string; method: "bank_transfer" | "unallocated_funds" },
  protectionId?: string
): Promise<{ paymentId: string | null; status: string | null }> {
  const { depositId, ...rest } = body;
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${RS}/deposits/${encodeURIComponent(depositId)}/payments`,
    { method: "POST", body: JSON.stringify(rest), protectionId }
  );
  const parsed = zPayment.parse(raw);
  return {
    paymentId: pickId(raw, "paymentId", "id"),
    status: parsed.status ?? null,
  };
}

/** Payments live at the service root, not under /deposits. */
export async function getPayment(
  ctx: MdContext,
  paymentId: string,
  protectionId?: string
): Promise<MdPayment> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${RS}/payments/${encodeURIComponent(paymentId)}`,
    { protectionId }
  );
  return zPayment.parse(raw);
}

/**
 * Bank-transfer instructions for a deposit.
 * Keyed by DEPOSIT id, not payment id — the old
 * `/deposits/payments/{paymentId}/details` route does not exist.
 */
export async function getPaymentDetails(
  ctx: MdContext,
  depositId: string,
  protectionId?: string
): Promise<Record<string, unknown>> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${RS}/deposits/${encodeURIComponent(depositId)}/payment-details`,
    { protectionId }
  );
  // Validate the known fields but cache the whole payload for the wizard.
  zPaymentDetails.parse(raw);
  return raw;
}

/** Cancel a pending payment. */
export async function cancelPayment(
  ctx: MdContext,
  paymentId: string,
  protectionId?: string
): Promise<void> {
  await mdFetch<unknown>(ctx, `${RS}/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
    protectionId,
  });
}
