import { requireModule } from "@/modules/guards";

export default async function EarningsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("earnings");
  return <>{children}</>;
}
