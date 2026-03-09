import { requireModule } from "@/modules/guards";

export default async function BonusesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("bonuses");
  return <>{children}</>;
}
