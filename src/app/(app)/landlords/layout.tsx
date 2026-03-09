import { requireModule } from "@/modules/guards";

export default async function LandlordsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("landlords");
  return <>{children}</>;
}
