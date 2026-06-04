import { z } from "zod";
import type { MdProtectionStatus } from "@/lib/mydeposits/statusMap";

export type { MdProtectionStatus } from "@/lib/mydeposits/statusMap";

export type MydepositsConnection = {
  tenant_id: string;
  environment: "sandbox" | "production";
  account_label: string | null;
  token_expiry: string;
  connected_by: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MdProtection = {
  id: string;
  tenant_id: string;
  contract_id: string;
  status: MdProtectionStatus;
  remote_property_id: string | null;
  remote_tenancy_id: string | null;
  remote_deposit_id: string | null;
  remote_payment_id: string | null;
  remote_landlord_id: string | null;
  deposit_amount_pence: number | null;
  api_version: string | null;
  remote_deposit_status: string | null;
  certificate_url: string | null;
  payment_instructions: Record<string, unknown> | null;
  last_polled_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  contract?: {
    id: string;
    deposit: number;
    deposit_scheme: string;
    start_date: string;
    expiry_date: string | null;
    rent_pcm: number;
    pm_tenant?: { full_name: string; email: string; phone: string } | null;
    unit?: {
      room_number: string | null;
      unit_type: string;
      property: { name: string; address_line_1: string } | null;
    } | null;
  } | null;
};

export type MdReleaseRequest = {
  id: string;
  tenant_id: string;
  protection_id: string;
  remote_release_id: string | null;
  status: string | null;
  available_actions: unknown[] | null;
  settlements: unknown[] | null;
  last_polled_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export const MD_STATUS_CONFIG: Record<MdProtectionStatus, { label: string; bg: string; fg: string }> = {
  draft:             { label: "Draft",             bg: "bg-gray-100",   fg: "text-gray-600"   },
  created_remote:    { label: "Created",           bg: "bg-blue-100",   fg: "text-blue-700"   },
  awaiting_payment:  { label: "Awaiting payment",  bg: "bg-amber-100",  fg: "text-amber-700"  },
  part_protected:    { label: "Part protected",    bg: "bg-amber-100",  fg: "text-amber-700"  },
  protected:         { label: "Protected",         bg: "bg-green-100",  fg: "text-green-700"  },
  release_requested: { label: "Release requested", bg: "bg-purple-100", fg: "text-purple-700" },
  released:          { label: "Released",          bg: "bg-cyan-100",   fg: "text-cyan-700"   },
  disputed:          { label: "Disputed",          bg: "bg-red-100",    fg: "text-red-700"    },
  cancelled:         { label: "Cancelled",         bg: "bg-gray-100",   fg: "text-gray-500"   },
  error:             { label: "Error",             bg: "bg-red-100",    fg: "text-red-700"    },
};

// ── Input schemas ──────────────────────────────────────────────────────────
export const secureDepositTenantSchema = z.object({
  fullName: z.string().min(1, "Tenant name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  isLead: z.boolean().default(false),
});

export const secureDepositSchema = z.object({
  contractId: z.string().uuid(),
  tenants: z.array(secureDepositTenantSchema).min(1, "At least one tenant is required"),
  landlord: z
    .object({ email: z.string().email().optional().nullable() })
    .optional(),
});

export const releaseRequestSchema = z.object({
  protectionId: z.string().uuid(),
});

export const settlementResponseSchema = z.object({
  protectionId: z.string().uuid(),
  releaseRequestId: z.string().min(1),
  settlementId: z.string().min(1),
  action: z.enum(["accept", "amend"]),
  payload: z.record(z.unknown()).optional(),
});

export type SecureDepositInput = z.infer<typeof secureDepositSchema>;
export type SettlementResponseInput = z.infer<typeof settlementResponseSchema>;
