import { CalendarCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getBookings } from "@/features/bookings/data/bookings";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { getBookingForms } from "@/features/booking-forms/data/booking-forms";
import { BookingsPage } from "@/features/bookings/ui/BookingsPage";

export default async function BookingsRoute() {
  await requireRole([...ADMIN_ROLES]);

  try {
    const [bookings, portfolios, forms] = await Promise.all([
      getBookings(),
      getPortfolios(),
      getBookingForms().catch(() => []),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const activeForms = forms
      .filter((f) => f.is_active)
      .map((f) => ({ id: f.id, name: f.name, slug: f.public_slug, url: `${appUrl}/apply/${f.public_slug}` }));

    return <BookingsPage initialBookings={bookings} portfolios={portfolios} bookingForms={activeForms} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable = message.includes("schema cache") || message.includes("does not exist");

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Bookings</h1>
        </div>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <CalendarCheck className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load bookings"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {isMissingTable
              ? "Apply the Phase 2 migrations in supabase/migrations/ to your Supabase database, then reload."
              : message}
          </p>
        </div>
      </div>
    );
  }
}
