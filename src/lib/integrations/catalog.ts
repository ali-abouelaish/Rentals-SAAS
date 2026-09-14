import type { FeatureKey } from "@/lib/entitlements/features";

/**
 * The integration catalogue.
 *
 * This is the single source of truth for what an agency can subscribe to, what
 * it costs, and which feature keys it unlocks. It lives in code rather than the
 * database on purpose: prices, copy and the feature mapping all change with a
 * deploy, and a database copy would be a second source of truth that drifts
 * from the gating logic it is supposed to describe.
 *
 * The database holds only the subscription — who has what, from when, at what
 * price (see `tenant_integration_subscriptions`).
 *
 * ADDING AN INTEGRATION
 *
 *   1. Add the entry here.
 *   2. If it gates a feature, add that key to `PAID_FEATURES` in
 *      `src/lib/entitlements/features.ts` so it defaults to off.
 *   3. That is all. Gating, the Integrations page, and the super-admin billing
 *      view are all driven from this list.
 */

export type IntegrationKey =
  | "e_signing"
  | "mydeposits"
  | "tds"
  | "dps"
  | "email_sending"
  | "xero"
  | "open_banking";

export type IntegrationCategory = "signing" | "deposits" | "communication" | "accounting" | "banking";

export type IntegrationAvailability =
  /** Subscribable today. */
  | "available"
  /** Listed so agencies can see it is coming; cannot be activated. */
  | "coming_soon";

/**
 * The provider's visual identity on the card.
 *
 * `src` is a path under `public/`, and is null for every integration today
 * because the repo carries no third-party brand assets. Until one is added the
 * card shows a monogram tile in the provider's brand colour, which reads as a
 * logo rather than as a missing image.
 *
 * ADDING A REAL LOGO: drop the file in `public/integrations/` (SVG preferred,
 * transparent background, roughly square) and set `src` to its path. Nothing
 * else changes — the fallback simply stops being used. Brand assets belong to
 * their owners; use the file the provider publishes in its own brand kit
 * rather than a redrawn approximation.
 */
export type IntegrationLogo = {
  /** e.g. "/integrations/xero.svg". Null until a real asset is added. */
  src: string | null;
  /**
   * The provider's brand colour, as the tile background. Chosen to be dark
   * enough for white text in both themes, since the tile carries its own
   * colour rather than inheriting the page's.
   */
  brandColor: string;
  /** One to three characters. Longer than that stops reading as a mark. */
  monogram: string;
};

export type Integration = {
  key: IntegrationKey;
  name: string;
  /** The third party, where there is one. Shown as the card's eyebrow. */
  provider: string;
  logo: IntegrationLogo;
  category: IntegrationCategory;
  availability: IntegrationAvailability;
  /** One line for the card. */
  summary: string;
  /** What the agency actually gets, as bullets. */
  benefits: string[];
  /**
   * Feature keys an active subscription grants. Empty for an integration that
   * gates nothing (a free one already available to everyone).
   */
  featureKeys: FeatureKey[];
  /** Monthly price in pence. Zero means free — no charge line is raised. */
  monthlyPricePence: number;
  /**
   * True when the integration needs credentials, an OAuth connection or a
   * verification step before it does anything. Activation lands in
   * `pending_setup` rather than `active`, and the card sends the agency to
   * `setupHref` to finish.
   */
  requiresSetup: boolean;
  /**
   * Who actually performs the setup.
   *
   * Not every integration can be self-configured. TDS and DPS issue API
   * credentials per agency, and applying them is a `requireSuperAdmin` action —
   * so sending the agency to a screen with a "Finish setup" button would be a
   * dead end. Those say we will do it, and mean it.
   */
  setupOwner: "agency" | "harbor_ops";
  /**
   * Where the agency completes setup, once subscribed. Null when there is
   * nothing for them to configure — either because setup is ours to do, or
   * because the integration works the moment it is switched on.
   */
  setupHref: string | null;
  /** Shown on the activation dialog, above the confirm button. */
  setupNote: string | null;
};

/**
 * Prices are placeholders pending a commercial decision. They are read from
 * here at activation time and then *frozen onto the subscription row*, so
 * changing a number here re-prices only agencies who subscribe afterwards —
 * never anyone already on it.
 */
export const INTEGRATIONS: Integration[] = [
  {
    key: "e_signing",
    name: "E-signing",
    provider: "BoldSign",
    logo: { src: null, brandColor: "#2F5DE0", monogram: "BS" },
    category: "signing",
    availability: "available",
    summary:
      "Send tenancy agreements, works orders and owner statements out for legally binding electronic signature.",
    benefits: [
      "Place signature boxes on your own contract templates, in the editor you already use",
      "Tenant then landlord signing order, enforced automatically",
      "Signed PDF and a tamper-evident audit trail stored against the record",
      "Contracts move to Signed on their own when the last party signs",
    ],
    featureKeys: ["e_signing"],
    monthlyPricePence: 2900,
    requiresSetup: false,
    setupOwner: "agency",
    setupHref: "/settings/e-signing",
    setupNote:
      "Nothing to set up — the Send for signature button appears on contracts and works orders straight away. Documents currently go out under the default Harbor Ops identity; per-agency branding is in progress.",
  },
  {
    key: "mydeposits",
    name: "mydeposits Deposit Protection",
    provider: "mydeposits (Total Property)",
    logo: { src: null, brandColor: "#00539F", monogram: "MD" },
    category: "deposits",
    availability: "available",
    summary:
      "Protect tenancy deposits with mydeposits without leaving Harbor Ops, and keep certificates against the tenancy.",
    benefits: [
      "Secure a deposit from the tenancy record",
      "Protection certificates tracked and downloadable",
      "Release requests raised and followed from one place",
    ],
    featureKeys: ["mydeposits"],
    monthlyPricePence: 1500,
    requiresSetup: true,
    setupOwner: "agency",
    setupHref: "/settings/deposits",
    setupNote:
      "You will connect your own mydeposits account after activating. Deposits cannot be protected until that connection is made.",
  },
  {
    key: "tds",
    name: "TDS Deposit Protection",
    provider: "Tenancy Deposit Scheme",
    logo: { src: null, brandColor: "#0B3C71", monogram: "TDS" },
    category: "deposits",
    availability: "available",
    summary:
      "Register custodial deposits with TDS, collect the DAN, and pull down protection certificates automatically.",
    benefits: [
      "Deposits registered against the tenancy",
      "Deposit Account Number polled and stored without chasing",
      "DPC certificates downloaded and filed",
      "Repayment requests raised from the tenancy record",
    ],
    featureKeys: ["tds"],
    monthlyPricePence: 1500,
    requiresSetup: true,
    setupOwner: "harbor_ops",
    setupHref: null,
    setupNote:
      "TDS issues API credentials per agency. Send us your TDS account details after activating and we will configure them — the integration stays in Setup needed until then.",
  },
  {
    key: "dps",
    name: "DPS Deposit Protection",
    provider: "Deposit Protection Service",
    logo: { src: null, brandColor: "#0072CE", monogram: "DPS" },
    category: "deposits",
    availability: "available",
    summary:
      "Register tenancies with the DPS and mark deposits for bank transfer with automatic allocation.",
    benefits: [
      "Tenancies registered from the contract record",
      "Deposits marked for bank transfer with auto-allocation",
      "Protection recorded against the tenancy",
    ],
    featureKeys: ["dps"],
    monthlyPricePence: 1500,
    requiresSetup: true,
    setupOwner: "harbor_ops",
    setupHref: null,
    setupNote:
      "DPS issues API credentials per agency. Send us your DPS client details after activating and we will configure them — the integration stays in Setup needed until then.",
  },
  {
    key: "email_sending",
    name: "Send from your own mailbox",
    provider: "Microsoft 365, Gmail or SMTP",
    logo: { src: null, brandColor: "#4F46E5", monogram: "M" },
    category: "communication",
    availability: "available",
    summary:
      "Send tenant and landlord emails from your agency's real address instead of the shared Harbor Ops mailer.",
    benefits: [
      "Connect Microsoft 365, Gmail, or any SMTP server",
      "Replies land in your own inbox",
      "Automatic fallback to the Harbor Ops mailer if your provider fails",
      "Delivery health checked daily",
    ],
    featureKeys: [],
    monthlyPricePence: 0,
    requiresSetup: true,
    setupOwner: "agency",
    setupHref: "/settings/email",
    setupNote:
      "Included in your plan at no extra cost. You will authorise your mailbox on the next screen.",
  },
  {
    key: "xero",
    name: "Xero",
    provider: "Xero",
    logo: { src: null, brandColor: "#13B5EA", monogram: "X" },
    category: "accounting",
    availability: "coming_soon",
    summary:
      "Push rent, management fees and owner statements into Xero so your accounts reconcile themselves.",
    benefits: [
      "Invoices and fees synced to Xero",
      "Owner statements posted as bills",
      "No monthly re-keying",
    ],
    featureKeys: [],
    monthlyPricePence: 0,
    requiresSetup: true,
    setupOwner: "agency",
    setupHref: null,
    setupNote: null,
  },
  {
    key: "open_banking",
    name: "Bank feeds",
    provider: "Open Banking",
    logo: { src: null, brandColor: "#0E9F6E", monogram: "OB" },
    category: "banking",
    availability: "coming_soon",
    summary:
      "Connect your client account so rent payments reconcile against tenancies as they land.",
    benefits: [
      "Transactions pulled in automatically",
      "Rent matched to tenancies by payment reference",
      "Arrears updated without manual marking",
    ],
    featureKeys: [],
    monthlyPricePence: 0,
    requiresSetup: true,
    setupOwner: "agency",
    setupHref: null,
    setupNote: null,
  },
];

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  signing: "E-signing",
  deposits: "Deposit protection",
  communication: "Communication",
  accounting: "Accounting",
  banking: "Banking",
};

/** Order categories appear on the page. */
export const CATEGORY_ORDER: IntegrationCategory[] = [
  "signing",
  "deposits",
  "communication",
  "accounting",
  "banking",
];

const BY_KEY = new Map(INTEGRATIONS.map((i) => [i.key, i]));

export function getIntegration(key: string): Integration | null {
  return BY_KEY.get(key as IntegrationKey) ?? null;
}

export function isIntegrationKey(value: string): value is IntegrationKey {
  return BY_KEY.has(value as IntegrationKey);
}

/** Formats pence as the price line shown on a card: "£29/month" or "Included". */
export function formatIntegrationPrice(pence: number): string {
  if (pence <= 0) return "Included";
  const pounds = pence / 100;
  const formatted = Number.isInteger(pounds) ? String(pounds) : pounds.toFixed(2);
  return `£${formatted}/month`;
}
