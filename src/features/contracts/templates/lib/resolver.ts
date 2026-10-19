import type { ContractTemplateField, ContractTerms, FieldFormat } from "../domain/types";

export type ResolverContext = {
  booking: {
    id: string;
    applicant_name: string | null;
    applicant_email: string | null;
    applicant_phone: string | null;
    submitted_at: string | null;
  };
  unit: {
    id: string;
    room_number: string | null;
    unit_type: string | null;
    min_price_pcm: number | null;
    max_price_pcm: number | null;
    deposit: number | null;
    holding_deposit: number | null;
  } | null;
  property: {
    id: string;
    name: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    postcode: string | null;
    area: string | null;
    property_type: string | null;
    bills: string | null;
  } | null;
  landlord: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  agency: {
    name: string | null;
  } | null;
  pmTenant: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    current_address: string | null;
  } | null;
  // booking_responses keyed by booking_form_questions.id
  responses: Map<string, { answer_text: string | null; answer_file_url: string | null; question_type: string | null }>;
  manualValues: Record<string, string>;
  contractId: string;
  standingOrderRef: string | null; // the tenancy's bank-reconciliation reference
  terms: ContractTerms;
};

const UK_TZ = "Europe/London";

const DEPOSIT_SCHEME_TEXT: Record<string, string> = {
  dps: "Deposit Protection Service (DPS)",
  mydeposits: "mydeposits",
  tds: "Tenancy Deposit Scheme (TDS)",
  none: "",
};

/** Today's date in the UK, as yyyy-mm-dd — not UTC, which is a day behind 00:00–01:00 BST. */
export function ukToday(now: Date = new Date()): string {
  // en-CA formats as yyyy-mm-dd.
  return new Intl.DateTimeFormat("en-CA", { timeZone: UK_TZ }).format(now);
}

/**
 * Add calendar days to a yyyy-mm-dd date, entirely in UTC. Mixing a UTC parse
 * with local setDate() loses a day across the spring clock change on a server
 * running UK time — which put the statutory deposit deadline a day early.
 */
export function addDaysIso(yyyyMmDd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateParts(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  // Reject rollovers like 31/02.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Format a date for a UK contract. Never hands a slash date to `new Date()`,
 * which reads "10/11/2026" American-style as 11 October.
 */
function formatDate(str: string): string {
  const s = str.trim();

  // yyyy-mm-dd — a calendar date, formatted as-is (no timezone shift).
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return formatDateParts(Number(m[1]), Number(m[2]), Number(m[3])) ?? s;

  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy — UK order.
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return formatDateParts(Number(m[3]), Number(m[2]), Number(m[1])) ?? s;

  // A full timestamp (e.g. submitted_at) — show the UK calendar date.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { timeZone: UK_TZ, day: "2-digit", month: "long", year: "numeric" });
    }
  }

  // Anything else ("1st October", free text) is printed exactly as entered.
  return s;
}

function formatValue(raw: unknown, format: FieldFormat): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const str = String(raw);

  switch (format) {
    case "currency_gbp": {
      const num = typeof raw === "number" ? raw : Number(str.replace(/[£,\s]/g, ""));
      if (!Number.isFinite(num)) return str;
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num);
    }
    case "number": {
      const num = typeof raw === "number" ? raw : Number(str.replace(/[,\s]/g, ""));
      if (!Number.isFinite(num)) return str;
      return new Intl.NumberFormat("en-GB").format(num);
    }
    case "date":
      return formatDate(str);
    case "multiline":
    case "text":
    default:
      return str;
  }
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function contractValue(key: string, terms: ContractTerms, format: FieldFormat): string {
  switch (key) {
    case "start_date":
      return formatValue(terms.start_date, format);
    case "expiry_date":
      return formatValue(terms.expiry_date, format);
    case "rent_pcm":
      return formatValue(terms.rent_pcm, format);
    case "deposit":
      return formatValue(terms.deposit, format);
    case "collection_date":
      if (terms.collection_date == null) return "";
      return format === "number" ? String(terms.collection_date) : ordinal(terms.collection_date);
    case "deposit_scheme":
      return terms.deposit_scheme ? DEPOSIT_SCHEME_TEXT[terms.deposit_scheme] ?? terms.deposit_scheme : "";
    default:
      return "";
  }
}

export function resolveFieldValue(field: ContractTemplateField, ctx: ResolverContext): string {
  switch (field.source) {
    case "booking_response": {
      if (!field.question_id) return "";
      const r = ctx.responses.get(field.question_id);
      if (!r) return "";
      // Skip non-stampable answer types — file uploads + info blocks.
      if (r.question_type === "file_upload" || r.question_type === "info") return "";
      return formatValue(r.answer_text ?? "", field.format);
    }
    case "property": {
      if (!ctx.property || !field.data_key) return "";
      const key = field.data_key.replace(/^property\./, "");
      return formatValue((ctx.property as Record<string, unknown>)[key], field.format);
    }
    case "unit": {
      if (!ctx.unit || !field.data_key) return "";
      const key = field.data_key.replace(/^unit\./, "");
      return formatValue((ctx.unit as Record<string, unknown>)[key], field.format);
    }
    case "landlord": {
      if (!ctx.landlord || !field.data_key) return "";
      const key = field.data_key.replace(/^landlord\./, "");
      return formatValue((ctx.landlord as Record<string, unknown>)[key], field.format);
    }
    case "agency": {
      if (!ctx.agency || !field.data_key) return "";
      const key = field.data_key.replace(/^agency\./, "");
      return formatValue((ctx.agency as Record<string, unknown>)[key], field.format);
    }
    case "booking": {
      if (!field.data_key) return "";
      const key = field.data_key.replace(/^booking\./, "");
      return formatValue((ctx.booking as Record<string, unknown>)[key], field.format);
    }
    case "pm_tenant": {
      if (!ctx.pmTenant || !field.data_key) return "";
      const key = field.data_key.replace(/^pm_tenant\./, "");
      return formatValue((ctx.pmTenant as Record<string, unknown>)[key], field.format);
    }
    case "contract": {
      if (!field.data_key) return "";
      return contractValue(field.data_key.replace(/^contract\./, ""), ctx.terms, field.format);
    }
    case "manual": {
      if (!field.manual_key) return "";
      const value = ctx.manualValues[field.manual_key] ?? field.manual_default ?? "";
      return formatValue(value, field.format);
    }
    case "computed": {
      if (!field.data_key) return "";
      switch (field.data_key) {
        case "computed.today":
          return formatValue(ukToday(), field.format);
        case "computed.deposit_protection_deadline":
          return formatValue(addDaysIso(ctx.terms.start_date, 30), field.format);
        case "computed.contract_id":
          return ctx.contractId;
        case "computed.standing_order_ref":
          return ctx.standingOrderRef ?? "";
        default:
          return "";
      }
    }
    default:
      return "";
  }
}
