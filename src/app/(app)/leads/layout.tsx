import { requireModule } from "@/modules/guards";

export default async function LeadsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("leads");
  return <>{children}</>;
}
