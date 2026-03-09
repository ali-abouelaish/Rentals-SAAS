import { requireModule } from "@/modules/guards";

export default async function ClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("clients");
  return <>{children}</>;
}
