import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import {
  getUploadFlags,
  getUploadTransactions,
  listStatementUploads,
} from "@/features/statements/data/queries";
import { StatementDetailPage } from "@/features/statements/ui/StatementDetailPage";

interface RouteProps {
  params: { id: string };
}

export default async function StatementDetailRoute({ params }: RouteProps) {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const entitlements = await getEntitlements();
  if (!entitlements.has("rent_collection")) {
    redirect("/dashboard?view=pm");
  }

  const uploads = await listStatementUploads();
  const upload = uploads.find((u) => u.id === params.id);
  if (!upload) {
    notFound();
  }

  const [transactions, flags] = await Promise.all([
    getUploadTransactions(params.id),
    getUploadFlags(params.id),
  ]);

  return <StatementDetailPage upload={upload} transactions={transactions} flags={flags} />;
}
