"use client";

import { format } from "date-fns";
import { BookingStatusBadge } from "./BookingStatusBadge";
import type { Booking } from "../domain/types";

interface BookingCardProps {
  booking: Booking;
  onClick: () => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export function BookingCard({ booking, onClick, dragHandleProps, isDragging }: BookingCardProps) {
  const unit = booking.unit;
  const portfolio = unit?.property?.portfolio;

  const unitLabel = unit
    ? `${unit.property.name} — ${unit.unit_type === "room" && unit.room_number ? `Room ${unit.room_number}` : unit.unit_type}`
    : "No unit";

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-border bg-surface-card p-3 space-y-2 cursor-pointer hover:shadow-bento transition-all ${
        isDragging ? "opacity-50 rotate-1 shadow-lg" : ""
      }`}
      {...dragHandleProps}
    >
      {/* Portfolio badge */}
      {portfolio && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: portfolio.color + "22",
            color: portfolio.color,
            border: `1px solid ${portfolio.color}44`,
          }}
        >
          {portfolio.name}
        </span>
      )}

      {/* Reference */}
      {booking.booking_reference && (
        <p className="font-mono text-[10px] font-medium text-foreground-muted">{booking.booking_reference}</p>
      )}

      {/* Applicant name */}
      <p className="text-sm font-semibold text-foreground leading-tight">{booking.applicant_name}</p>

      {/* Unit */}
      <p className="text-[11px] text-foreground-secondary">{unitLabel}</p>

      {/* Agent + offer (agent-originated bookings from a share link) */}
      {booking.agent_name && (
        <p className="text-[11px] text-foreground-muted">
          Agent: <span className="font-medium text-foreground-secondary">{booking.agent_name}</span>
          {booking.offer_price_pcm != null &&
            ` · £${booking.offer_price_pcm.toLocaleString("en-GB")} pcm`}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-foreground-muted">
          {format(new Date(booking.submitted_at), "d MMM yyyy")}
        </span>
        <BookingStatusBadge status={booking.status} size="sm" />
      </div>
    </div>
  );
}
