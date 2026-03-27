"use client";

import { useState, useEffect, useTransition } from "react";
import { Check, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { approveBooking, rejectBooking, updateBookingStatus, updateBookingNotes } from "../actions/bookings";
import type { Booking } from "../domain/types";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "responses", label: "Form Responses" },
  { value: "actions", label: "Actions" },
];

function OverviewContent({ booking, onSaved }: { booking: Booking; onSaved: (b: Booking) => void }) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(booking.notes ?? "");

  useEffect(() => { setNotes(booking.notes ?? ""); }, [booking.notes]);

  const unitLabel = booking.unit
    ? `${booking.unit.property.name} — ${booking.unit.unit_type === "room" && booking.unit.room_number ? `Room ${booking.unit.room_number}` : booking.unit.unit_type}`
    : "—";

  const handleSaveNotes = () => {
    startTransition(async () => {
      try {
        await updateBookingNotes(booking.id, notes);
        toast.success("Notes saved");
        onSaved({ ...booking, notes });
      } catch {
        toast.error("Failed to save notes");
      }
    });
  };

  return (
    <div className="space-y-5 py-1">
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-3">Applicant</h3>
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Full name" value={booking.applicant_name} />
          <InfoRow label="Email" value={booking.applicant_email} />
          <InfoRow label="Phone" value={booking.applicant_phone} />
          <InfoRow label="Submitted" value={format(new Date(booking.submitted_at), "d MMM yyyy, HH:mm")} />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-3">Application</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <InfoRow label="Unit applied for" value={unitLabel} />
          </div>
          {booking.unit?.property.portfolio && (
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted block mb-1">Portfolio</span>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: booking.unit.property.portfolio.color + "22",
                  color: booking.unit.property.portfolio.color,
                }}
              >
                {booking.unit.property.portfolio.name}
              </span>
            </div>
          )}
          {booking.reviewed_at && (
            <InfoRow label="Reviewed at" value={format(new Date(booking.reviewed_at), "d MMM yyyy")} />
          )}
          {booking.rejection_reason && (
            <div className="col-span-2">
              <InfoRow label="Rejection reason" value={booking.rejection_reason} />
            </div>
          )}
          {booking.converted_pm_tenant_id && (
            <div className="col-span-2">
              <InfoRow label="Converted to tenant" value="Yes — tenant record created" />
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-2">Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
          placeholder="Add notes about this application…"
        />
        {notes !== (booking.notes ?? "") && (
          <div className="flex justify-end mt-2">
            <Button type="button" variant="secondary" size="sm" loading={isPending} onClick={handleSaveNotes}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Save notes
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function ResponsesContent({ booking }: { booking: Booking }) {
  const responses = booking.form_responses ?? [];

  if (responses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-foreground-muted">
        No form responses recorded for this booking.
      </p>
    );
  }

  return (
    <div className="space-y-4 py-1">
      {responses.map((r) => (
        <div key={r.id} className="rounded-lg border border-border bg-surface-inset p-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            {r.question?.question_text ?? "Question"}
          </p>
          {r.answer_file_url ? (
            <a
              href={r.answer_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View uploaded file
            </a>
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap">{r.answer_text || "—"}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ActionsContent({
  booking,
  onBookingUpdated,
}: {
  booking: Booking;
  onBookingUpdated: (b: Booking) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const isTerminal = booking.status === "approved" || booking.status === "rejected";

  const handleApprove = () => {
    startTransition(async () => {
      try {
        await approveBooking(booking.id);
        toast.success("Booking approved — tenant and contract draft created");
        onBookingUpdated({ ...booking, status: "approved" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to approve booking");
      }
    });
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }
    startTransition(async () => {
      try {
        await rejectBooking(booking.id, rejectionReason.trim());
        toast.success("Booking rejected");
        onBookingUpdated({ ...booking, status: "rejected", rejection_reason: rejectionReason.trim() });
        setRejectMode(false);
      } catch {
        toast.error("Failed to reject booking");
      }
    });
  };

  const handleMarkUnderReview = () => {
    startTransition(async () => {
      try {
        await updateBookingStatus(booking.id, "under_review");
        toast.success("Marked as under review");
        onBookingUpdated({ ...booking, status: "under_review" });
      } catch {
        toast.error("Failed to update status");
      }
    });
  };

  if (isTerminal) {
    return (
      <div className="py-4 space-y-3">
        <div className={cn(
          "rounded-lg border p-4",
          booking.status === "approved" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        )}>
          <p className={cn(
            "text-sm font-semibold",
            booking.status === "approved" ? "text-green-800" : "text-red-800"
          )}>
            {booking.status === "approved"
              ? "Booking has been approved. A pm_tenant record and draft contract have been created."
              : "Booking has been rejected."}
          </p>
          {booking.rejection_reason && (
            <p className="text-xs text-red-700 mt-1">Reason: {booking.rejection_reason}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 space-y-4">
      {/* Approve */}
      <div className="rounded-lg border border-border bg-surface-card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Approve Application</h3>
        <p className="text-xs text-foreground-muted">
          Creates a tenant record, links to the unit (if set), and opens a draft contract.
        </p>
        <Button
          type="button"
          className="bg-green-600 hover:bg-green-700 text-white w-full"
          size="sm"
          loading={isPending}
          onClick={handleApprove}
        >
          Approve Booking
        </Button>
      </div>

      {/* Reject */}
      <div className="rounded-lg border border-border bg-surface-card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Reject Application</h3>
        {rejectMode ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Rejection reason *</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              placeholder="Enter the reason for rejection…"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white flex-1"
                size="sm"
                loading={isPending}
                onClick={handleReject}
              >
                Confirm Rejection
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setRejectMode(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 w-full"
            size="sm"
            onClick={() => setRejectMode(true)}
          >
            Reject Booking
          </Button>
        )}
      </div>

      {/* Mark under review */}
      {booking.status === "pending" && (
        <div className="rounded-lg border border-border bg-surface-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Mark as Under Review</h3>
          <p className="text-xs text-foreground-muted">Indicates this application is currently being reviewed.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={isPending}
            onClick={handleMarkUnderReview}
            className="w-full"
          >
            Mark Under Review
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────────

interface BookingDrawerProps {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
  onBookingUpdated: (b: Booking) => void;
}

export function BookingDrawer({ booking, open, onClose, onBookingUpdated }: BookingDrawerProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [localBooking, setLocalBooking] = useState<Booking | null>(booking);

  useEffect(() => {
    setLocalBooking(booking);
    setActiveTab("overview");
  }, [booking?.id]);

  if (!localBooking) return null;

  const handleUpdated = (updated: Booking) => {
    setLocalBooking(updated);
    onBookingUpdated(updated);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex flex-col p-0 w-full max-w-[540px]">
        {/* Header */}
        <SheetHeader className="shrink-0">
          <div className="space-y-1.5 min-w-0">
            <BookingStatusBadge status={localBooking.status} />
            <h2 className="text-base font-semibold text-foreground">{localBooking.applicant_name}</h2>
            <p className="text-xs text-foreground-secondary">{localBooking.applicant_email}</p>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="border-b border-border px-6 pt-2 pb-0 shrink-0">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px",
                  activeTab === tab.value
                    ? "border-brand text-brand"
                    : "border-transparent text-foreground-secondary hover:text-foreground hover:border-border"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "overview" && (
            <OverviewContent booking={localBooking} onSaved={handleUpdated} />
          )}
          {activeTab === "responses" && (
            <ResponsesContent booking={localBooking} />
          )}
          {activeTab === "actions" && (
            <ActionsContent booking={localBooking} onBookingUpdated={handleUpdated} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
