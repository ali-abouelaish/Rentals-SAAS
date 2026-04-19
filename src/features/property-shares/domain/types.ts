import type { UnitStatus } from "@/features/properties/domain/types";

export type PropertyShare = {
  id: string;
  tenant_id: string;
  token: string;
  name: string;
  description: string | null;
  availability_statuses: UnitStatus[];
  commission_override_pct: number;
  expires_at: string | null;
  revoked_at: string | null;
  portfolio_id: string | null;
  property_ids: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ShareScope =
  | { kind: "all" }
  | { kind: "portfolio"; portfolio_id: string }
  | { kind: "properties"; property_ids: string[] };

export function deriveShareScope(share: Pick<PropertyShare, "portfolio_id" | "property_ids">): ShareScope {
  if (share.portfolio_id) return { kind: "portfolio", portfolio_id: share.portfolio_id };
  if (share.property_ids && share.property_ids.length > 0) {
    return { kind: "properties", property_ids: share.property_ids };
  }
  return { kind: "all" };
}

export type ShareView = {
  id: string;
  share_id: string;
  viewed_at: string;
  ip_hash: string | null;
  user_agent: string | null;
};

export type ShareStatus = "active" | "expired" | "revoked";

export function deriveShareStatus(share: Pick<PropertyShare, "revoked_at" | "expires_at">): ShareStatus {
  if (share.revoked_at) return "revoked";
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}
