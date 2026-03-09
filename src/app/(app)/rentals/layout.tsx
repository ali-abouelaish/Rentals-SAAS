import { requireModule } from "@/modules/guards";

export default async function RentalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("rentals");
  return <>{children}</>;
}
