import { requireModule } from "@/modules/guards";

export default async function BillingProfilesLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireModule("billing_profiles");
  return <>{children}</>;
}

