import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_REF_ATTEMPTS = 5;

function formatReference(year: number, seq: number): string {
  return `HO-${year}-${String(seq).padStart(6, "0")}`;
}

async function peekNextSeq(tenantId: string, year: number): Promise<number> {
  const admin = createSupabaseAdminClient();
  const startOfYear = new Date(Date.UTC(year, 0, 1)).toISOString();
  const startOfNextYear = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

  const { count } = await admin
    .from("maintenance_tickets")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", startOfYear)
    .lt("created_at", startOfNextYear);

  return (count ?? 0) + 1;
}

export type CreateTicketArgs = {
  tenantId: string;
  propertyId: string;
  unitId: string;
  pmTenantId: string;
  conversationId: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  attachmentIds: string[];
};

export type CreateTicketResult = {
  id: string;
  reference: string;
};

/**
 * Creates a maintenance_tickets row with a per-tenant, per-year sequence number.
 * Retries on unique-constraint collision (concurrent inserts).
 * Reassigns any supplied attachments from the conversation to the new ticket.
 */
export async function createTicket(
  args: CreateTicketArgs
): Promise<CreateTicketResult> {
  const admin = createSupabaseAdminClient();
  const year = new Date().getUTCFullYear();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt += 1) {
    const seq = (await peekNextSeq(args.tenantId, year)) + attempt;
    const reference = formatReference(year, seq);

    const { data, error } = await admin
      .from("maintenance_tickets")
      .insert({
        tenant_id: args.tenantId,
        property_id: args.propertyId,
        unit_id: args.unitId,
        pm_tenant_id: args.pmTenantId,
        conversation_id: args.conversationId,
        reference,
        description: args.description,
        priority: args.priority,
        status: "open",
      })
      .select("id, reference")
      .single();

    if (!error && data) {
      if (args.attachmentIds.length > 0) {
        await admin
          .from("maintenance_attachments")
          .update({ parent_id: data.id, parent_type: "ticket" })
          .in("id", args.attachmentIds)
          .eq("tenant_id", args.tenantId);
      }
      return { id: data.id as string, reference: data.reference as string };
    }

    lastError = error;

    const code = (error as { code?: string } | null)?.code;
    if (code !== "23505") {
      break;
    }
  }

  throw lastError ?? new Error("Could not allocate ticket reference.");
}
