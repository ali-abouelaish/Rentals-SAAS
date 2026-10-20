import { requireModule } from "@/modules/guards";

export default async function SharesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("property_shares");
  return <>{children}</>;
}
