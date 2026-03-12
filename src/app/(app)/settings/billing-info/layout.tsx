import { requireModule } from "@/modules/guards";

export default async function BillingInfoLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireModule("billing_info");
  return <>{children}</>;
}

