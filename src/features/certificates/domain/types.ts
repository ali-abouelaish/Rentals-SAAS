import { z } from "zod";

export const CERTIFICATE_TYPES = [
  "gas_safety",
  "eicr",
  "epc",
  "fire_alarm",
  "emergency_lighting",
  "legionella",
  "pat",
  "hmo_licence",
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  gas_safety: "Gas Safety (CP12)",
  eicr: "EICR",
  epc: "EPC",
  fire_alarm: "Fire Alarm",
  emergency_lighting: "Emergency Lighting",
  legionella: "Legionella Risk Assessment",
  pat: "PAT",
  hmo_licence: "HMO Licence",
};

/** Amber window: certificates expiring within this many days count as "expiring soon". */
export const EXPIRING_SOON_DAYS = 30;

export type CertificateStatus = "expired" | "expiring_soon" | "valid";

/**
 * Status is always derived from expiry_date at read time (never stored), so
 * the dashboard can never show a stale colour.
 */
export function certificateStatus(
  expiryISO: string,
  todayISO: string = new Date().toISOString().slice(0, 10)
): CertificateStatus {
  if (expiryISO < todayISO) return "expired";
  const expiry = new Date(`${expiryISO}T00:00:00Z`).getTime();
  const today = new Date(`${todayISO}T00:00:00Z`).getTime();
  const daysLeft = Math.round((expiry - today) / (24 * 60 * 60 * 1000));
  return daysLeft <= EXPIRING_SOON_DAYS ? "expiring_soon" : "valid";
}

export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  expired: "Expired",
  expiring_soon: "Expiring soon",
  valid: "Valid",
};

export type Certificate = {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string | null;
  type: CertificateType;
  issue_date: string;
  expiry_date: string;
  /** Storage path inside the private certificate_docs bucket. */
  document_url: string | null;
  contractor_id: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contractor?: { id: string; name: string; email: string | null } | null;
  unit?: { id: string; room_number: string | null; unit_type: string } | null;
  property?: {
    id: string;
    name: string;
    address_line_1: string;
    postcode: string | null;
  } | null;
};

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const certificateInputSchema = z
  .object({
    propertyId: z.string().uuid("Choose a property"),
    unitId: z.string().uuid().nullable().default(null),
    type: z.enum(CERTIFICATE_TYPES, {
      errorMap: () => ({ message: "Choose a certificate type" }),
    }),
    issueDate: dateISO,
    expiryDate: dateISO,
    contractorId: z.string().uuid().nullable().default(null),
    reference: z.string().trim().max(100, "Max 100 characters").default(""),
    notes: z.string().trim().max(1000, "Max 1000 characters").default(""),
  })
  .refine((v) => v.expiryDate > v.issueDate, {
    message: "Expiry must be after the issue date",
    path: ["expiryDate"],
  });
export type CertificateInput = z.infer<typeof certificateInputSchema>;
