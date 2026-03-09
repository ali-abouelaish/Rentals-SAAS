import { requireModule } from "@/modules/guards";

export default async function InvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("invoices");
  return <>{children}</>;
}
