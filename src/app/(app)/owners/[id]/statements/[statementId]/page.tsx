import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { getOwnerStatement } from "@/features/owner-statements/data/owner-statements";
import { OwnerStatementDetail } from "@/features/owner-statements/ui/OwnerStatementDetail";

export default async function OwnerStatementRoute({
  params,
}: {
  params: { id: string; statementId: string };
}) {
  await requireRole([...ADMIN_ROLES]);
  await requireFeature("owner_statements");

  const statement = await getOwnerStatement(params.statementId);
  if (!statement) notFound();

  // Guard against a statement id pasted under the wrong landlord.
  if (statement.owner_id !== params.id) {
    redirect(`/owners/${statement.owner_id}/statements/${statement.id}`);
  }

  return <OwnerStatementDetail statement={statement} />;
}
