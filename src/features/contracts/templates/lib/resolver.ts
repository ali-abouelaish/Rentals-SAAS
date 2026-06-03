import type { ContractTemplateField, FieldFormat } from "../domain/types";

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
  // booking_responses keyed by form_questions.id
  responses: Map<string, { answer_text: string | null; answer_file_url: string | null; question_type: string | null }>;
  manualValues: Record<string, string>;
  contractId: string;
  startDate: string; // yyyy-mm-dd (used for computed deposit_protection_deadline)
};

function formatValue(raw: unknown, format: FieldFormat): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const str = String(raw);

  switch (format) {
    case "currency_gbp": {
      const num = typeof raw === "number" ? raw : Number(str);
      if (!Number.isFinite(num)) return str;
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num);
    }
    case "number": {
      const num = typeof raw === "number" ? raw : Number(str);
      if (!Number.isFinite(num)) return str;
      return new Intl.NumberFormat("en-GB").format(num);
    }
    case "date": {
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) return str;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    }
    case "multiline":
    case "text":
    default:
      return str;
  }
}

function addDays(yyyy_mm_dd: string, days: number): string {
  const d = new Date(yyyy_mm_dd);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
    case "manual": {
      if (!field.manual_key) return "";
      const value = ctx.manualValues[field.manual_key] ?? field.manual_default ?? "";
      return formatValue(value, field.format);
    }
    case "computed": {
      if (!field.data_key) return "";
      switch (field.data_key) {
        case "computed.today":
          return formatValue(new Date().toISOString().slice(0, 10), field.format || "date");
        case "computed.deposit_protection_deadline":
          return formatValue(addDays(ctx.startDate, 30), field.format || "date");
        case "computed.contract_id":
          return ctx.contractId;
        default:
          return "";
      }
    }
    default:
      return "";
  }
}
