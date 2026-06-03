// RealityStone service: properties, tenancies, deposits, payments, certificates.
// Endpoint paths are best-effort (see config.ts MD_SERVICE / MD_API_VERSION).
// Each function parses only the fields we read via the passthrough schemas.

import { mdFetch, type MdContext } from "./apiClient";
import { MD_API_VERSION, MD_SERVICE } from "./config";
import {
  zProperty,
  zLandlordInvite,
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

export type TenancyTenant = {
  fullName: string;
  email: string;
  phone?: string | null;
  dob?: string | null;
  isLead: boolean;
};

export async function canLandlordBeInvited(
  ctx: MdContext,
  landlordEmail: string,
  protectionId?: string
): Promise<{ canBeInvited: boolean; landlordId: string | null }> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${RS}/landlords/can-be-invited?email=${encodeURIComponent(landlordEmail)}`,
    { protectionId }
  );
  const parsed = zLandlordInvite.parse(raw);
  return {
    canBeInvited: parsed.canBeInvited ?? true,
    landlordId: pickId(raw, "landlordId", "id"),
  };
}

export async function addPropertyByAgency(
  ctx: MdContext,
  body: {
    addressLine1: string;
    addressLine2?: string | null;
    postcode?: string | null;
    area?: string | null;
  },
  protectionId?: string
): Promise<{ propertyId: string | null }> {
  const raw = await mdFetch<Record<string, unknown>>(ctx, `${RS}/properties/add-by-agency`, {
    method: "POST",
    body: JSON.stringify(body),
    protectionId,
  });
  zProperty.parse(raw);
  return { propertyId: pickId(raw, "propertyId", "id") };
}

export async function createTenancy(
  ctx: MdContext,
  body: {
    propertyId: string;
    startDate: string;
    expiryDate?: string | null;
    rentAmount: number;
    rentFrequency: string;
    tenants: TenancyTenant[];
  },
  protectionId?: string
): Promise<{ tenancyId: string | null }> {
  const raw = await mdFetch<Record<string, unknown>>(ctx, `${RS}/tenancies`, {
    method: "POST",
    body: JSON.stringify(body),
    protectionId,
  });
  zTenancy.parse(raw);
  return { tenancyId: pickId(raw, "tenancyId", "id") };
}

export async function getDepositAmount(
  ctx: MdContext,
  tenancyId: string,
  protectionId?: string
): Promise<number | null> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${RS}/tenancies/${encodeURIComponent(tenancyId)}/deposit-amount`,
    { protectionId }
  );
  const parsed = zDepositAmount.parse(raw);
  return parsed.depositAmount ?? parsed.amount ?? null;
}

export async function createDeposit(
  ctx: MdContext,
  body: { tenancyId: string; amount: number },
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

export async function createDepositPayment(
  ctx: MdContext,
  body: { depositId: string; method: "bank_transfer" | "unallocated_funds" },
  protectionId?: string
): Promise<{ paymentId: string | null; status: string | null }> {
  const raw = await mdFetch<Record<string, unknown>>(ctx, `${RS}/deposits/payments`, {
    method: "POST",
    body: JSON.stringify(body),
    protectionId,
  });
  const parsed = zPayment.parse(raw);
  return {
    paymentId: pickId(raw, "paymentId", "id"),
    status: parsed.status ?? null,
  };
}

export async function getPayment(
  ctx: MdContext,
  paymentId: string,
  protectionId?: string
): Promise<MdPayment> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${RS}/deposits/payments/${encodeURIComponent(paymentId)}`,
    { protectionId }
  );
  return zPayment.parse(raw);
}

export async function getPaymentDetails(
  ctx: MdContext,
  paymentId: string,
  protectionId?: string
): Promise<Record<string, unknown>> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${RS}/deposits/payments/${encodeURIComponent(paymentId)}/details`,
    { protectionId }
  );
  // Validate the known fields but cache the whole payload for the wizard.
  zPaymentDetails.parse(raw);
  return raw;
}
