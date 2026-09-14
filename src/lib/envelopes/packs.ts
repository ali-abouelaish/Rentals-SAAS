/**
 * Envelope packs and the monthly allowance.
 *
 * An ENVELOPE is one document sent for signature, whatever the number of
 * signers — the convention BoldSign and DocuSign both use, so it is the unit
 * agencies already expect to be counted in.
 *
 * Dependency-free on purpose: `node --test` can load it, and it is imported by
 * both server and client code, so it must pull in neither a database client
 * nor `server-only`.
 *
 * Prices are placeholders pending a commercial decision, and are frozen onto
 * the purchase row at the moment of sale — changing a number here re-prices
 * only future purchases, never one already made.
 */

export type EnvelopePack = {
  key: string;
  envelopes: number;
  pricePence: number;
  /** Shown on the busiest pack so the choice isn't purely arithmetic. */
  highlight?: "best_value" | "popular";
};

/**
 * Envelopes included with an active e-signing subscription each month.
 *
 * Resets on the 1st and does not roll over. Applied only when the period rolls
 * over, so changing this number never disturbs a month already part-spent.
 */
export const MONTHLY_ALLOWANCE = 20;

/**
 * Top-up packs. Never expire.
 *
 * Priced so the per-envelope rate falls with size — the usual reason to buy
 * the bigger pack, and it means a busy agency isn't punished for volume.
 */
export const ENVELOPE_PACKS: EnvelopePack[] = [
  { key: "pack_25", envelopes: 25, pricePence: 2500 },
  { key: "pack_100", envelopes: 100, pricePence: 8000, highlight: "popular" },
  { key: "pack_250", envelopes: 250, pricePence: 17500, highlight: "best_value" },
];

const BY_KEY = new Map(ENVELOPE_PACKS.map((pack) => [pack.key, pack]));

export function getEnvelopePack(key: string): EnvelopePack | null {
  return BY_KEY.get(key) ?? null;
}

/** Pence per envelope, for the "works out at X each" line. */
export function pricePerEnvelopePence(pack: EnvelopePack): number {
  return pack.pricePence / pack.envelopes;
}

/** "£25" or "£1.75" — whole pounds lose the trailing ".00". */
export function formatPence(pence: number): string {
  const pounds = pence / 100;
  return Number.isInteger(pounds) ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

/**
 * The per-envelope rate, which is usually not a whole number of pence.
 *
 * Rounded to the nearest penny for display only — never for billing, which
 * uses the pack price as a single integer and so cannot accumulate rounding
 * error across a purchase.
 */
export function formatPerEnvelope(pack: EnvelopePack): string {
  const each = pricePerEnvelopePence(pack);
  return `${formatPence(Math.round(each))} each`;
}

export type EnvelopeBalance = {
  /** Remaining from this month's included allowance. Expires on the 1st. */
  allowanceRemaining: number;
  /** What the plan grants each month. */
  allowanceTotal: number;
  /** Purchased envelopes. No expiry. */
  topupRemaining: number;
  /** What can actually be sent right now. */
  remaining: number;
  lifetimeSent: number;
};

export const EMPTY_BALANCE: EnvelopeBalance = {
  allowanceRemaining: 0,
  allowanceTotal: MONTHLY_ALLOWANCE,
  topupRemaining: 0,
  remaining: 0,
  lifetimeSent: 0,
};

/**
 * When to start warning that envelopes are running out.
 *
 * Low enough not to nag, high enough that an agency sending a few documents a
 * week has time to buy before it becomes urgent. The point is that nobody
 * should ever meet the hard stop by surprise.
 */
export const LOW_BALANCE_THRESHOLD = 5;

export function isLowBalance(balance: EnvelopeBalance): boolean {
  return balance.remaining > 0 && balance.remaining <= LOW_BALANCE_THRESHOLD;
}
