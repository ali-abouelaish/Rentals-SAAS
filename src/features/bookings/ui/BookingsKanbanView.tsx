"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { BookingCard } from "./BookingCard";
import { BOOKING_STATUS_CONFIG, BOOKING_COLUMNS, type Booking, type BookingStatus } from "../domain/types";
import { updateBookingStatus } from "../actions/bookings";

interface BookingsKanbanViewProps {
  bookings: Booking[];
  onBookingClick: (id: string) => void;
  onBookingsChange: (bookings: Booking[]) => void;
}

export function BookingsKanbanView({ bookings, onBookingClick, onBookingsChange }: BookingsKanbanViewProps) {
  const [isPending, startTransition] = useTransition();

  const handleDrop = (bookingId: string, newStatus: BookingStatus) => {
    // Only allow drag between pending ↔ under_review
    if (!["pending", "under_review"].includes(newStatus)) return;

    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || booking.status === newStatus) return;
    if (!["pending", "under_review"].includes(booking.status)) return;

    // Optimistic update
    onBookingsChange(
      bookings.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
    );

    startTransition(async () => {
      try {
        await updateBookingStatus(bookingId, newStatus);
      } catch {
        // Revert
        onBookingsChange(
          bookings.map((b) => (b.id === bookingId ? { ...b, status: booking.status } : b))
        );
        toast.error("Failed to update status");
      }
    });
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
      {BOOKING_COLUMNS.map((column) => {
        const cfg = BOOKING_STATUS_CONFIG[column];
        const columnBookings = bookings.filter((b) => b.status === column);
        const isDraggableTarget = ["pending", "under_review"].includes(column);

        return (
          <div
            key={column}
            className="rounded-xl border border-border bg-surface-inset"
            onDragOver={(e) => {
              if (isDraggableTarget) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!isDraggableTarget) return;
              const bookingId = e.dataTransfer.getData("bookingId");
              if (bookingId) handleDrop(bookingId, column);
            }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
              </div>
              <span className="text-[11px] text-foreground-muted bg-surface-card rounded-full px-1.5 py-0.5">
                {columnBookings.length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[120px]">
              {columnBookings.map((booking) => (
                <div
                  key={booking.id}
                  draggable={["pending", "under_review"].includes(booking.status)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("bookingId", booking.id);
                  }}
                >
                  <BookingCard
                    booking={booking}
                    onClick={() => onBookingClick(booking.id)}
                  />
                </div>
              ))}
              {columnBookings.length === 0 && (
                <p className="text-center text-[11px] text-foreground-muted py-4">Empty</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
