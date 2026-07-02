"use client";

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { ArrowRight, Check, ExternalLink, FileSignature, Send, FileText, Clock, CheckCircle2, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { rejectBooking, updateBookingStatus, updateBookingNotes } from "../actions/bookings";
import { getBookingHubData, type BookingHubData } from "../actions/booking-hub";
import { sendFormLinks } from "@/features/forms/actions/form-send";
import type { Booking } from "../domain/types";
import { CreateContractFromTemplateDialog } from "@/features/contracts/templates/ui/CreateContractFromTemplateDialog";
import { ConvertToTenancyDialog } from "./ConvertToTenancyDialog";

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  signed: "Signed",
  active: "Active",
  notice_given: "Notice given",
  terminated: "Terminated",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}


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

      {(booking.agent_name || booking.source === "share") && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-3">
            Agent &amp; offer
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Agent" value={booking.agent_name} />
            <InfoRow label="Agent email" value={booking.agent_email} />
            <InfoRow
              label="Offer price"
              value={
                booking.offer_price_pcm != null
                  ? `£${booking.offer_price_pcm.toLocaleString("en-GB")} pcm`
                  : null
              }
            />
            {booking.source === "share" && <InfoRow label="Source" value="Share link" />}
          </div>
        </section>
      )}

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

// Collapsible "grouped by form" wrapper used by both the application responses
// and the sent-form responses.
function CollapsibleSection({
  title,
  meta,
  count,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-surface-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-inset transition-colors"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-foreground-muted transition-transform", open ? "" : "-rotate-90")}
          />
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          {typeof count === "number" && (
            <span className="shrink-0 text-[11px] text-foreground-muted">
              {count} answer{count === 1 ? "" : "s"}
            </span>
          )}
        </span>
        {meta && <span className="shrink-0">{meta}</span>}
      </button>
      {open && <div className="border-t border-border px-3 py-3">{children}</div>}
    </div>
  );
}

function ResponseCard({
  questionText,
  answerText,
  fileUrl,
}: {
  questionText?: string | null;
  answerText?: string | null;
  fileUrl?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-inset p-3 space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
        {questionText ?? "Question"}
      </p>
      {fileUrl ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View uploaded file
        </a>
      ) : (
        <p className="text-sm text-foreground whitespace-pre-wrap">{answerText || "—"}</p>
      )}
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
    <div className="space-y-3 py-1">
      <CollapsibleSection
        title={booking.form?.name ?? "Application form"}
        count={responses.length}
        defaultOpen
      >
        <div className="space-y-3">
          {responses.map((r) => (
            <ResponseCard
              key={r.id}
              questionText={r.question?.question_text}
              answerText={r.answer_text}
              fileUrl={r.answer_file_url}
            />
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function FormsContent({
  booking,
  hub,
  loading,
  onSent,
}: {
  booking: Booking;
  hub: BookingHubData | null;
  loading: boolean;
  onSent: () => void;
}) {
  const [formId, setFormId] = useState("");
  const [email, setEmail] = useState(booking.applicant_email);
  const [isPending, startTransition] = useTransition();

  const activeForms = hub?.activeForms ?? [];
  const sends = hub?.sends ?? [];

  // Group sends by the form they belong to so responses are grouped per form.
  const sendGroups = useMemo(() => {
    const map = new Map<string, { name: string; sends: typeof sends }>();
    for (const s of sends) {
      const existing = map.get(s.form_id);
      if (existing) existing.sends.push(s);
      else map.set(s.form_id, { name: s.form?.name ?? "Form", sends: [s] });
    }
    return [...map.values()];
  }, [sends]);

  const handleSend = () => {
    if (!formId) {
      toast.error("Pick a form to send");
      return;
    }
    if (!email.trim()) {
      toast.error("Enter a recipient email");
      return;
    }
    startTransition(async () => {
      try {
        const res = await sendFormLinks(formId, [email.trim()], booking.id);
        if (res.sent > 0) {
          toast.success("Form sent");
          setFormId("");
          onSent();
        } else {
          toast.error(res.errors[0] ?? "Failed to send form");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send form");
      }
    });
  };

  return (
    <div className="space-y-5 py-1">
      <section className="rounded-lg border border-border bg-surface-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Send a form to this applicant</h3>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-foreground-muted">Form</label>
          <select
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          >
            <option value="">Select a form…</option>
            {activeForms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-foreground-muted">Recipient email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            placeholder="applicant@example.com"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={isPending}
          onClick={handleSend}
          className="w-full"
          title="Email this applicant a link to the selected form; their response is tracked against this booking"
        >
          <Send size={14} /> Send form
        </Button>
        {activeForms.length === 0 && !loading && (
          <p className="text-xs text-foreground-muted">No active forms yet — create one under Forms first.</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Forms sent</h3>
        {loading && sends.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground-muted">Loading…</p>
        ) : sends.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground-muted">
            No forms have been sent for this booking yet.
          </p>
        ) : (
          <div className="space-y-3">
            {sendGroups.map((g, gi) => {
              const completed = g.sends.filter((s) => s.status === "completed").length;
              const total = g.sends.length;
              return (
                <CollapsibleSection
                  key={g.name + gi}
                  title={g.name}
                  defaultOpen={sendGroups.length === 1}
                  meta={
                    completed > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> {completed}/{total} completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        <Clock className="h-3 w-3" /> Awaiting
                      </span>
                    )
                  }
                >
                  <div className="space-y-3">
                    {g.sends.map((s) => (
                      <div key={s.id} className="rounded-lg border border-border bg-surface-inset p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-foreground-muted truncate">{s.recipient_email}</p>
                          {s.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 shrink-0">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 shrink-0">
                              <Clock className="h-3 w-3" /> Sent
                            </span>
                          )}
                        </div>
                        {s.submission?.answers?.length ? (
                          <div className="space-y-2 border-t border-border pt-2">
                            {s.submission.answers.map((a, i) => (
                              <ResponseCard key={i} questionText={a.question_text} answerText={a.answer_text} />
                            ))}
                          </div>
                        ) : null}
                        <p className="text-[10px] text-foreground-muted">
                          Sent {format(new Date(s.sent_at), "d MMM yyyy, HH:mm")}
                          {s.completed_at && ` · Completed ${format(new Date(s.completed_at), "d MMM yyyy, HH:mm")}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ActionsContent({
  booking,
  onBookingUpdated,
  contracts,
  onContractsChanged,
}: {
  booking: Booking;
  onBookingUpdated: (b: Booking) => void;
  contracts: BookingHubData["contracts"];
  onContractsChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const isTerminal = booking.status === "approved" || booking.status === "rejected";

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
              ? "Tenant and contract created — see the contract drawer for status."
              : "Booking has been rejected."}
          </p>
          {booking.rejection_reason && (
            <p className="text-xs text-red-700 mt-1">Reason: {booking.rejection_reason}</p>
          )}
        </div>

        {contracts.length > 0 && (
          <div className="rounded-lg border border-border bg-surface-card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Contracts</h3>
            <div className="space-y-2">
              {contracts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-inset px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-foreground-muted shrink-0" />
                    <span className="text-xs font-medium text-foreground">
                      {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
                    </span>
                    {c.last_generated_at && (
                      <span className="text-[11px] text-foreground-muted truncate">
                        · generated {format(new Date(c.last_generated_at), "d MMM yyyy")}
                      </span>
                    )}
                  </div>
                  {c.document_url && (
                    <a
                      href={c.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand hover:underline shrink-0"
                      title="Open the generated contract PDF"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {booking.status === "approved" && booking.converted_pm_tenant_id && booking.unit_id && (
          <div className="rounded-lg border border-border bg-surface-card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Generate contract from template</h3>
            <p className="text-xs text-foreground-secondary">
              Pick a template and we&apos;ll stamp the booking + property data onto your contract PDF, then attach it to the draft contract for signing.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setTemplateDialogOpen(true)}
              className="w-full"
              title="Stamp this booking's data onto a contract template and attach the PDF for signing"
            >
              <FileSignature size={14} /> Create contract from template
            </Button>
          </div>
        )}

        <CreateContractFromTemplateDialog
          open={templateDialogOpen}
          onClose={() => {
            setTemplateDialogOpen(false);
            onContractsChanged();
          }}
          bookingId={booking.id}
          portfolioId={booking.portfolio_id}
          responses={booking.form_responses ?? []}
          applicant={{
            name: booking.applicant_name,
            email: booking.applicant_email,
            phone: booking.applicant_phone,
          }}
        />
      </div>
    );
  }

  return (
    <div className="py-2 space-y-4">
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
  hasFormsEntitlement: boolean;
}

export function BookingDrawer({ booking, open, onClose, onBookingUpdated, hasFormsEntitlement }: BookingDrawerProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [localBooking, setLocalBooking] = useState<Booking | null>(booking);
  const [convertOpen, setConvertOpen] = useState(false);
  const [hubData, setHubData] = useState<BookingHubData | null>(null);
  const [hubLoading, setHubLoading] = useState(false);

  const loadHub = useCallback((bookingId: string) => {
    setHubLoading(true);
    getBookingHubData(bookingId)
      .then(setHubData)
      .catch(() => toast.error("Failed to load booking details"))
      .finally(() => setHubLoading(false));
  }, []);

  useEffect(() => {
    setLocalBooking(booking);
    setActiveTab("overview");
    setConvertOpen(false);
    setHubData(null);
  }, [booking?.id]);

  // Lazily load forms-sent + contracts the first time those tabs are opened.
  useEffect(() => {
    if (!localBooking) return;
    if ((activeTab === "forms" || activeTab === "actions") && !hubData && !hubLoading) {
      loadHub(localBooking.id);
    }
  }, [activeTab, localBooking, hubData, hubLoading, loadHub]);

  if (!localBooking) return null;

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "responses", label: "Form Responses" },
    ...(hasFormsEntitlement ? [{ value: "forms", label: "Sent Forms" }] : []),
    { value: "actions", label: "Actions" },
  ];

  const handleUpdated = (updated: Booking) => {
    setLocalBooking(updated);
    onBookingUpdated(updated);
  };

  const canConvert =
    localBooking.status === "pending" || localBooking.status === "under_review";

  const handleConverted = (patch: Partial<Booking>) => {
    handleUpdated({ ...localBooking, ...patch });
    // Reload so the Actions tab's contracts list shows the freshly attached PDF.
    setActiveTab("actions");
    loadHub(localBooking.id);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex flex-col p-0 w-full max-w-[540px]">
        {/* Header */}
        <SheetHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <BookingStatusBadge status={localBooking.status} />
                {localBooking.booking_reference && (
                  <span
                    className="inline-flex items-center rounded-md bg-surface-inset px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground-secondary"
                    title="Booking reference — use it to track this application end to end"
                  >
                    {localBooking.booking_reference}
                  </span>
                )}
              </div>
              <h2 className="text-base font-semibold text-foreground">{localBooking.applicant_name}</h2>
              <p className="text-xs text-foreground-secondary">{localBooking.applicant_email}</p>
            </div>
            {canConvert && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConvertOpen(true)}
                className="shrink-0"
              >
                Convert to tenancy
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <ConvertToTenancyDialog
          open={convertOpen}
          onClose={() => setConvertOpen(false)}
          booking={localBooking}
          onConverted={handleConverted}
        />

        {/* Tabs */}
        <div className="border-b border-border px-6 pt-2 pb-0 shrink-0">
          <div className="flex">
            {tabs.map((tab) => (
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
          {activeTab === "forms" && hasFormsEntitlement && (
            <FormsContent
              booking={localBooking}
              hub={hubData}
              loading={hubLoading}
              onSent={() => loadHub(localBooking.id)}
            />
          )}
          {activeTab === "actions" && (
            <ActionsContent
              booking={localBooking}
              onBookingUpdated={handleUpdated}
              contracts={hubData?.contracts ?? []}
              onContractsChanged={() => loadHub(localBooking.id)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
