import { requireModule } from "@/modules/guards";

export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("maintenance");
  return <>{children}</>;
}
