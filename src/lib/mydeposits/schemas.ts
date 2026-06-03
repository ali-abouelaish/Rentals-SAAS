// Zod shapes for the mydeposits API. The docs don't publish response schemas,
// so every shape is `.passthrough()` and only the fields we actually read are
// declared. Remote ids may be numeric or string — always coerce to string.

import { z } from "zod";

const zId = z.union([z.string(), z.number()]).transform(String);
const zOptId = z
  .union([z.string(), z.number()])
  .transform(String)
  .optional()
  .nullable();

/** Pick the first present id-ish field from a passthrough object. */
export function pickId(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
}

export const zProperty = z
  .object({ id: zOptId, propertyId: zOptId })
  .passthrough();

export const zLandlordInvite = z
  .object({ canBeInvited: z.boolean().optional(), landlordId: zOptId })
  .passthrough();

export const zTenancy = z
  .object({ id: zOptId, tenancyId: zOptId })
  .passthrough();

export const zDepositAmount = z
  .object({ amount: z.number().optional(), depositAmount: z.number().optional() })
  .passthrough();

export const zDeposit = z
  .object({
    id: zOptId,
    depositId: zOptId,
    status: z.string().optional().nullable(),
    depositStatus: z.string().optional().nullable(),
    certificateUrl: z.string().optional().nullable(),
  })
  .passthrough();

export const zPayment = z
  .object({
    id: zOptId,
    paymentId: zOptId,
    status: z.string().optional().nullable(),
  })
  .passthrough();

/** Payment instructions cached for the wizard's final "transfer £X" screen. */
export const zPaymentDetails = z
  .object({
    amount: z.number().optional(),
    sortCode: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    accountName: z.string().optional().nullable(),
    reference: z.string().optional().nullable(),
  })
  .passthrough();

export const zReleaseRequest = z
  .object({
    id: zOptId,
    releaseRequestId: zOptId,
    status: z.string().optional().nullable(),
    availableActions: z.array(z.unknown()).optional().nullable(),
  })
  .passthrough();

export const zSettlement = z
  .object({
    id: zOptId,
    settlementId: zOptId,
    status: z.string().optional().nullable(),
    amount: z.number().optional().nullable(),
  })
  .passthrough();

export const zSettlementList = z.array(zSettlement);

export type MdDeposit = z.infer<typeof zDeposit>;
export type MdPayment = z.infer<typeof zPayment>;
export type MdReleaseRequest = z.infer<typeof zReleaseRequest>;
export type MdSettlement = z.infer<typeof zSettlement>;

export { zId };
