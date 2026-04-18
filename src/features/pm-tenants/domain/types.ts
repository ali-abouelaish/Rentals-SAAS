export type EmploymentStatus =
  | "professional"
  | "student"
  | "self_employed"
  | "unemployed"
  | "other";

export type RightToRentType =
  | "british_passport"
  | "share_code"
  | "eu_settled"
  | "visa"
  | "other";

export type PmTenant = {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  phone: string;
  whatsapp_number: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  current_address: string | null;
  employment_status: EmploymentStatus | null;
  employer_name: string | null;
  employer_address: string | null;
  job_title: string | null;
  current_landlord_name: string | null;
  current_landlord_contact: string | null;
  right_to_rent_type: RightToRentType | null;
  right_to_rent_code: string | null;
  right_to_rent_expiry: string | null;
  right_to_rent_verified: boolean;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  notes: string | null;
  passport_photo_url: string | null;
  passport_scan_url: string | null;
  created_at: string;
  updated_at: string;
  // joined relations
  guarantors?: Guarantor[];
  current_unit?: {
    id: string;
    room_number: string | null;
    unit_type: string;
    property: { name: string; address_line_1: string };
  } | null;
  current_contract?: {
    id: string;
    start_date: string;
    status: string;
    document_url: string | null;
  } | null;
};

export type Guarantor = {
  id: string;
  tenant_id: string;
  pm_tenant_id: string;
  full_name: string;
  phone: string;
  email: string;
  relationship: string | null;
  passport_url: string | null;
  payslips_url: string | null;
  created_at: string;
};

export type PmTenantFilters = {
  search: string;
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  professional: "Professional",
  student: "Student",
  self_employed: "Self Employed",
  unemployed: "Unemployed",
  other: "Other",
};

export const RIGHT_TO_RENT_LABELS: Record<RightToRentType, string> = {
  british_passport: "British Passport",
  share_code: "Share Code",
  eu_settled: "EU Settled/Pre-Settled",
  visa: "Visa",
  other: "Other",
};
