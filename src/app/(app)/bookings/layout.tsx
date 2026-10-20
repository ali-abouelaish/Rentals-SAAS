import { requireModule } from "@/modules/guards";

export default async function BookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("bookings");
  return <>{children}</>;
}
