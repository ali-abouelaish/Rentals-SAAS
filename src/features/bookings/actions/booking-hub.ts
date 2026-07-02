"use server";

import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getBookingFormSends, type BookingFormSend } from "@/features/forms/data/booking-form-sends";
import { getActiveForms } from "@/features/forms/data/forms";
import { getContractsForBooking } from "@/features/contracts/data/contracts";
import type { Form } from "@/features/forms/domain/types";
import type { PropertyContract } from "@/features/contracts/domain/types";
import { getBookingById } from "../data/bookings";

export type BookingHubData = {
  sends: BookingFormSend[];
  contracts: PropertyContract[];
  activeForms: Form[];
};

// Everything the booking drawer aggregates around the reference: forms sent (with
// their responses), generated contracts, and the active forms available to send.
export async function getBookingHubData(bookingId: string): Promise<BookingHubData> {
  await requireRole([...ADMIN_ROLES]);

  const booking = await getBookingById(bookingId);
  if (!booking) throw new Error("Booking not found");

  const [sends, activeForms, contracts] = await Promise.all([
    getBookingFormSends(bookingId),
    getActiveForms(),
    getContractsForBooking({
      id: booking.id,
      unit_id: booking.unit_id,
      converted_pm_tenant_id: booking.converted_pm_tenant_id,
    }),
  ]);

  return { sends, contracts, activeForms };
}
