import { requireModule } from "@/modules/guards";

export default async function PropertiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("properties");
  return <>{children}</>;
}
