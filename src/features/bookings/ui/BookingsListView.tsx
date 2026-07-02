"use client";

import { CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils/cn";
import { BookingStatusBadge } from "./BookingStatusBadge";
import type { Booking } from "../domain/types";

interface BookingsListViewProps {
  bookings: Booking[];
  onBookingClick: (id: string) => void;
}

export function BookingsListView({ bookings, onBookingClick }: BookingsListViewProps) {
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CalendarCheck className="h-12 w-12 text-foreground-muted mb-3" />
        <h3 className="text-base font-semibold text-foreground">No bookings yet</h3>
        <p className="text-sm text-foreground-secondary mt-1">
          Share a booking form link and applications will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
      <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted border-b border-border bg-surface-inset">
        <span>Applicant</span>
        <span>Unit</span>
        <span>Portfolio</span>
        <span>Submitted</span>
        <span>Status</span>
      </div>

      {bookings.map((booking, i) => {
        const unit = booking.unit;
        const portfolio = unit?.property?.portfolio;
        const unitLabel = unit
          ? `${unit.property.name} — ${unit.unit_type === "room" && unit.room_number ? `Room ${unit.room_number}` : unit.unit_type}`
          : "—";

        return (
          <button
            key={booking.id}
            type="button"
            onClick={() => onBookingClick(booking.id)}
            className={cn(
              "w-full grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr] gap-4 px-4 py-3.5 text-left text-sm",
              "hover:bg-surface-inset transition-colors cursor-pointer",
              i % 2 === 0 ? "" : "bg-surface-inset/40"
            )}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              {booking.booking_reference && (
                <span className="font-mono text-[10px] font-medium text-foreground-muted">{booking.booking_reference}</span>
              )}
              <span className="font-medium text-foreground truncate">{booking.applicant_name}</span>
              <span className="text-[11px] text-foreground-muted truncate">{booking.applicant_email}</span>
            </div>
            <div className="text-xs text-foreground-secondary truncate flex items-center">{unitLabel}</div>
            <div className="flex items-center">
              {portfolio ? (
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: portfolio.color + "22", color: portfolio.color }}
                >
                  {portfolio.name}
                </span>
              ) : (
                <span className="text-xs text-foreground-muted">—</span>
              )}
            </div>
            <div className="text-xs text-foreground-secondary flex items-center">
              {format(new Date(booking.submitted_at), "d MMM yyyy")}
            </div>
            <div className="flex items-center">
              <BookingStatusBadge status={booking.status} size="sm" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
