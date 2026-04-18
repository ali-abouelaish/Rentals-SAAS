import { z } from "zod";

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === "" ? null : val), schema);

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
  furnishings: z.enum(["furnished", "unfurnished", "part_furnished"]).default("furnished"),
  drive_folder_url: z.string().nullable().optional().or(z.literal("")),
  resident_id: z.string().uuid().nullable().optional().or(z.literal("")),
});
export type UnitFormValues = z.infer<typeof unitSchema>;

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
