import { z } from "zod";

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === "" ? null : val), schema);

// ── Lenient helpers for edit schemas ─────────────────────────
// These accept anything, normalise empty/undefined → null, and never reject.

const lenientStr = z.preprocess(
  (val) => (val === "" || val === undefined ? null : val),
  z.string().nullable()
);

const lenientNum = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) return null;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isFinite(n) ? n : null;
  },
  z.number().nullable()
);

const lenientEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return null;
      return (values as readonly string[]).includes(val as string) ? val : null;
    },
    z.enum(values as unknown as [string, ...string[]]).nullable()
  );

const lenientBool = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) return null;
    if (typeof val === "string") return val === "true";
    return Boolean(val);
  },
  z.boolean().nullable()
);

export const portfolioSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().min(1, "Color is required"),
});
export type PortfolioFormValues = z.infer<typeof portfolioSchema>;

export const propertySchema = z.object({
  portfolio_id: emptyToNull(z.string().uuid().nullable().optional()),
  property_type: z.enum(["hmo", "studio", "whole_flat"]),
  name: z.string().min(1, "Name is required"),
  address_line_1: z.string().min(1, "Address is required"),
  address_line_2: z.string().nullable().optional().or(z.literal("")),
  postcode: z.string().min(1, "Postcode is required"),
  area: z.string().nullable().optional().or(z.literal("")),
  nearest_tube_station: z.string().nullable().optional().or(z.literal("")),
  total_rooms: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().positive().optional()
  ),
  total_bathrooms: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().positive().optional()
  ),
  bills: z.enum(["all_included", "top_up_gas_elec", "top_up_elec", "top_up_gas"]).nullable().optional(),
  bills_notes: z.string().nullable().optional().or(z.literal("")),
  furnished: z.boolean().default(true),
  parking: z.boolean().default(false),
  garden: z.boolean().default(false),
  broadband: z.boolean().default(true),
  washing_machine: z.boolean().default(true),
  dishwasher: z.boolean().default(false),
  central_heating: z.boolean().default(true),
  separate_wc: z.boolean().default(false),
  smoker_ok: z.boolean().default(false),
  pets_ok: z.boolean().default(false),
  preferred_occupation: z.enum(["professional", "student", "any"]).default("any"),
  preferred_gender: z.enum(["male", "female", "any"]).default("any"),
  min_age: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().positive().optional()
  ),
  max_age: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().positive().optional()
  ),
  floor_plan_url: z.string().url().nullable().optional().or(z.literal("")),
  owner_landlord_id: emptyToNull(z.string().uuid().nullable().optional()),
  manager_landlord_id: emptyToNull(z.string().uuid().nullable().optional()),
  contract_start_date: emptyToNull(z.string().nullable().optional()),
  contract_expiry_date: emptyToNull(z.string().nullable().optional()),
  monthly_rent_owed: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().positive().optional()
  ),
  payment_schedule: z.enum(["monthly", "quarterly", "biannual", "annual"]).nullable().optional(),
  contract_document_url: z.string().nullable().optional().or(z.literal("")),
});
export type PropertyFormValues = z.infer<typeof propertySchema>;

// Lenient edit schema: no required/format validations, every field nullable.
// Used only for the "edit property" flow — create still uses propertySchema.
export const propertyEditSchema = z.object({
  portfolio_id: lenientStr,
  property_type: lenientEnum(["hmo", "studio", "whole_flat"] as const),
  name: lenientStr,
  address_line_1: lenientStr,
  address_line_2: lenientStr,
  postcode: lenientStr,
  area: lenientStr,
  nearest_tube_station: lenientStr,
  total_rooms: lenientNum,
  total_bathrooms: lenientNum,
  bills: lenientEnum(["all_included", "top_up_gas_elec", "top_up_elec", "top_up_gas"] as const),
  bills_notes: lenientStr,
  furnished: lenientBool,
  parking: lenientBool,
  garden: lenientBool,
  broadband: lenientBool,
  washing_machine: lenientBool,
  dishwasher: lenientBool,
  central_heating: lenientBool,
  separate_wc: lenientBool,
  smoker_ok: lenientBool,
  pets_ok: lenientBool,
  preferred_occupation: lenientEnum(["professional", "student", "any"] as const),
  preferred_gender: lenientEnum(["male", "female", "any"] as const),
  min_age: lenientNum,
  max_age: lenientNum,
  floor_plan_url: lenientStr,
  owner_landlord_id: lenientStr,
  manager_landlord_id: lenientStr,
  contract_start_date: lenientStr,
  contract_expiry_date: lenientStr,
  monthly_rent_owed: lenientNum,
  payment_schedule: lenientEnum(["monthly", "quarterly", "biannual", "annual"] as const),
  contract_document_url: lenientStr,
}).partial();
export type PropertyEditValues = z.infer<typeof propertyEditSchema>;

export const unitSchema = z.object({
  property_id: z.string().uuid(),
  unit_type: z.enum(["room", "studio", "whole_flat"]),
  room_number: z.string().nullable().optional().or(z.literal("")),
  room_type: z.enum(["single", "double", "master", "ensuite"]).nullable().optional(),
  status: z.enum(["available", "occupied", "move_out", "booked", "on_hold", "renewal", "replacement"]).default("available"),
  notice_given: z.boolean().default(false),
  available_date: z.string().nullable().optional().or(z.literal("")),
  min_price_pcm: z.coerce.number().int().positive().nullable().optional(),
  max_price_pcm: z.coerce.number().int().positive().nullable().optional(),
  couples_allowed: z.boolean().default(false),
  couples_price_pcm: z.coerce.number().int().positive().nullable().optional(),
  deposit: z.coerce.number().int().positive().nullable().optional(),
  holding_deposit: z.coerce.number().int().nonnegative().nullable().optional(),
  furnishings: z.enum(["furnished", "unfurnished", "part_furnished"]).default("furnished"),
  drive_folder_url: z.string().nullable().optional().or(z.literal("")),
  resident_id: z.string().uuid().nullable().optional().or(z.literal("")),
});
export type UnitFormValues = z.infer<typeof unitSchema>;

// Lenient edit schema for units — no validations, every field nullable.
export const unitEditSchema = z.object({
  property_id: lenientStr,
  unit_type: lenientEnum(["room", "studio", "whole_flat"] as const),
  room_number: lenientStr,
  room_type: lenientEnum(["single", "double", "master", "ensuite"] as const),
  status: lenientEnum(["available", "occupied", "move_out", "booked", "on_hold", "renewal", "replacement"] as const),
  notice_given: lenientBool,
  available_date: lenientStr,
  min_price_pcm: lenientNum,
  max_price_pcm: lenientNum,
  couples_allowed: lenientBool,
  couples_price_pcm: lenientNum,
  deposit: lenientNum,
  holding_deposit: lenientNum,
  furnishings: lenientEnum(["furnished", "unfurnished", "part_furnished"] as const),
  drive_folder_url: lenientStr,
  resident_id: lenientStr,
}).partial();
export type UnitEditValues = z.infer<typeof unitEditSchema>;

export const unitStatusUpdateSchema = z.object({
  status: z.enum(["available", "occupied", "move_out", "booked", "on_hold", "renewal", "replacement"]),
  available_date: z.string().nullable().optional().or(z.literal("")),
  notice_given: z.boolean().optional(),
  hold_reason: z.string().nullable().optional().or(z.literal("")),
});
export type UnitStatusUpdateValues = z.infer<typeof unitStatusUpdateSchema>;

export const ownerLandlordSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().nullable().optional().or(z.literal("")),
  email: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  contract_start_date: z.string().nullable().optional().or(z.literal("")),
  contract_expiry_date: z.string().nullable().optional().or(z.literal("")),
  monthly_rent_owed: z.coerce.number().positive().nullable().optional(),
  payment_schedule: z.enum(["monthly", "quarterly", "biannual", "annual"]).nullable().optional(),
  alert_60_days: z.boolean().default(false),
  alert_30_days: z.boolean().default(false),
  contract_document_url: z.string().nullable().optional().or(z.literal("")),
});
export type OwnerLandlordFormValues = z.infer<typeof ownerLandlordSchema>;

export const propertyManagerSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  company_name: z.string().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional().or(z.literal("")),
  email: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  notes: z.string().nullable().optional().or(z.literal("")),
});
export type PropertyManagerFormValues = z.infer<typeof propertyManagerSchema>;


export const residentSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  phone: z.string().nullable().optional().or(z.literal("")),
  email: z.string().email().nullable().optional().or(z.literal("")),
  date_of_birth: z.string().nullable().optional().or(z.literal("")),
  nationality: z.string().nullable().optional().or(z.literal("")),
  occupation: z.string().nullable().optional().or(z.literal("")),
});
export type ResidentFormValues = z.infer<typeof residentSchema>;
