import { requireModule } from "@/modules/guards";

export default async function TenantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("pm_tenants");
  return <>{children}</>;
}
