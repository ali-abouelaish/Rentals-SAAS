/**
 * The one place rental and bonus money is split. Every earnings, approval,
 * commission-file and payout-summary calculation should go through here so the
 * VAT and fee rules can't drift apart again.
 */

/** Real processing cost of taking the money. Only card machines charge one;
 *  cash and bank transfers cost nothing to receive. VAT is separate — see vatRate. */
export function paymentFeeRate(method: string): number {
  if (method === "card") return 0.0175;
  return 0;
}

/** VAT deducted after the payment fee. Card-machine and transfer rentals are
 *  subject to VAT (20%) — unless the rental was created while the agency had
 *  "Deduct VAT from rentals before commission" switched off
 *  (`rental_codes.vat_applies = false`). Rows from before the switch existed
 *  have no flag, which means VAT applies. */
export function vatRate(method: string, vatApplies: boolean | null = true): number {
  if (vatApplies === false) return 0;
  return method === "card" || method === "transfer" ? 0.2 : 0;
}

/** Rentals not yet approved follow the agency's current VAT switch; approval
 *  freezes the flag onto the rental (rental_codes.vat_applies). */
export const VAT_FOLLOWS_SETTING_STATUSES = ["pending", "need_more_info"] as const;

/** Whether VAT applies to a rental: the agency's current switch while it's
 *  awaiting approval, otherwise what was recorded on the rental. */
export function effectiveVatApplies(
  status: string,
  storedVatApplies: boolean | null,
  agencyVatEnabled: boolean
): boolean {
  return (VAT_FOLLOWS_SETTING_STATUSES as readonly string[]).includes(status)
    ? agencyVatEnabled
    : storedVatApplies !== false;
}

/** Fee after the card fee and (when it applies) VAT — the base that agent and
 *  manager commission percentages are taken from. */
export function computeRentalNet(
  amount: number,
  method: string,
  vatApplies: boolean | null = true
): number {
  const afterFee = Number(amount ?? 0) * (1 - paymentFeeRate(method));
  const divisor = 1 + vatRate(method, vatApplies);
  return roundMoney(afterFee / divisor);
}

/** The agent's share of a bonus: everything on a "full" payout, otherwise
 *  their commission percentage. The company keeps the rest. */
export function bonusAgentShare(
  amount: number,
  payoutMode: string | null | undefined,
  commissionPercent: number
): number {
  const owed = Number(amount ?? 0);
  if (payoutMode === "full") return owed;
  return roundMoney(owed * (Number(commissionPercent ?? 0) / 100));
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
