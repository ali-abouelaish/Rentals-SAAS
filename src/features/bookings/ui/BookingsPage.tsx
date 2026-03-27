"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Link2, Copy, ExternalLink, ChevronDown, Settings } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { BookingFilterBar } from "./BookingFilterBar";
import { BookingsListView } from "./BookingsListView";
import { BookingsKanbanView } from "./BookingsKanbanView";
import { BookingDrawer } from "./BookingDrawer";
import type { Booking, BookingFilters } from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";

const DEFAULT_FILTERS: BookingFilters = {
  search: "",
  portfolioId: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

interface ActiveForm {
  id: string;
  name: string;
  slug: string;
  url: string;
}

interface BookingsPageProps {
  initialBookings: Booking[];
  portfolios: Portfolio[];
  bookingForms: ActiveForm[];
}

function FormLinksDropdown({ forms }: { forms: ActiveForm[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const copyLink = (url: string, name: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`Link for "${name}" copied`);
    setOpen(false);
  };

  if (forms.length === 0) {
    return (
      <Link
        href="/settings/booking-forms"
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-inset transition-colors"
      >
        <Link2 className="h-4 w-4" />
        No active forms
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-inset transition-colors"
      >
        <Link2 className="h-4 w-4" />
        Share form
        {forms.length > 1 && (
          <span className="text-[11px] font-medium bg-brand/10 text-brand rounded-full px-1.5">
            {forms.length}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 rounded-xl border border-border bg-surface-card shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">
              Active booking forms
            </span>
            <Link
              href="/settings/booking-forms"
              onClick={() => setOpen(false)}
              className="text-[11px] text-foreground-muted hover:text-foreground flex items-center gap-1"
            >
              <Settings className="h-3 w-3" />
              Manage
            </Link>
          </div>

          <div className="py-1">
            {forms.map((form) => (
              <div key={form.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-surface-inset">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{form.name}</p>
                  <p className="text-[11px] text-foreground-muted truncate">/apply/{form.slug}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyLink(form.url, form.name)}
                    title="Copy link"
                    className="p-1.5 rounded-lg hover:bg-surface-card text-foreground-muted hover:text-foreground transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={form.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open form"
                    className="p-1.5 rounded-lg hover:bg-surface-card text-foreground-muted hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function BookingsPage({ initialBookings, portfolios, bookingForms }: BookingsPageProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [filters, setFilters] = useState<BookingFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredBookings = useMemo(() => {
    let result = bookings;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(
        (b) =>
          b.applicant_name.toLowerCase().includes(s) ||
          b.applicant_email.toLowerCase().includes(s) ||
          b.unit?.property.name.toLowerCase().includes(s)
      );
    }
    if (filters.portfolioId) {
      result = result.filter((b) => b.unit?.property.portfolio?.id === filters.portfolioId);
    }
    if (filters.status) {
      result = result.filter((b) => b.status === filters.status);
    }
    if (filters.dateFrom) {
      result = result.filter((b) => b.submitted_at >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter((b) => b.submitted_at <= filters.dateTo + "T23:59:59");
    }
    return result;
  }, [bookings, filters]);

  const selectedBooking = bookings.find((b) => b.id === selectedId) ?? null;

  const handleBookingClick = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  const handleBookingUpdated = (updated: Booking) => {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Bookings</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Rental applications submitted via your booking forms
          </p>
        </div>
        <FormLinksDropdown forms={bookingForms} />
      </div>

      <BookingFilterBar
        filters={filters}
        onChange={setFilters}
        portfolios={portfolios}
        view={view}
        onViewChange={setView}
        total={filteredBookings.length}
      />

      {view === "list" ? (
        <BookingsListView bookings={filteredBookings} onBookingClick={handleBookingClick} />
      ) : (
        <BookingsKanbanView
          bookings={filteredBookings}
          onBookingClick={handleBookingClick}
          onBookingsChange={setBookings}
        />
      )}

      <BookingDrawer
        booking={selectedBooking}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onBookingUpdated={handleBookingUpdated}
      />
    </div>
  );
}
