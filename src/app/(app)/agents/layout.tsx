import { requireModule } from "@/modules/guards";

export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("agents");
  return <>{children}</>;
}
