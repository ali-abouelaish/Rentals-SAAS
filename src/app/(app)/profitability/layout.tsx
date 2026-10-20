import { requireModule } from "@/modules/guards";

export default async function ProfitabilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("profitability");
  return <>{children}</>;
}
