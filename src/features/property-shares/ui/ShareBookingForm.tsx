"use client";

import { useState, useTransition } from "react";
import { Send, CheckCircle2, AlertCircle, FileText, Loader2 } from "lucide-react";
import {
  getShareUnitBookingForms,
  sendShareBookingForm,
  type ShareBookingFormOption,
} from "../actions/booking";
import type { PublicShareUnit } from "../data/public";

interface ShareBookingFormProps {
  unit: PublicShareUnit;
  token: string;
}

const WEEKS_PER_MONTH = 52 / 12; // holding deposit ≈ 1 week's rent

const fieldCls =
  "h-11 w-full rounded-2xl border border-border bg-surface-card px-4 text-sm text-foreground placeholder:text-foreground-muted shadow-xs transition focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "block text-xs font-medium uppercase tracking-[0.14em] text-foreground-muted";

export function ShareBookingForm({ unit, token }: ShareBookingFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forms, setForms] = useState<ShareBookingFormOption[]>([]);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [formId, setFormId] = useState("");

  const handleOpen = () => {
    setOpen(true);
    setLoading(true);
    setLoadError(null);
    getShareUnitBookingForms(token, unit.id)
      .then((res) => {
        if (res.ok) {
          setForms(res.forms);
          setFormId(res.forms[0]?.id ?? "");
          setMinPrice(res.minPrice);
          setMaxPrice(res.maxPrice);
          setOfferPrice(res.minPrice != null ? String(res.minPrice) : "");
        } else {
          setLoadError(res.error);
        }
      })
      .catch(() => setLoadError("Could not load booking forms"))
      .finally(() => setLoading(false));
  };

  const parsedOffer = Number(offerPrice);
  const holdingDeposit =
    Number.isFinite(parsedOffer) && parsedOffer > 0
      ? Math.round(parsedOffer / WEEKS_PER_MONTH)
      : null;

  const rangeLabel =
    minPrice != null && maxPrice != null
      ? minPrice === maxPrice
        ? `£${minPrice.toLocaleString("en-GB")} pcm`
        : `£${minPrice.toLocaleString("en-GB")} – £${maxPrice.toLocaleString("en-GB")} pcm`
      : null;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendShareBookingForm({
        token,
        unitId: unit.id,
        formId,
        agentName,
        agentEmail,
        applicantName,
        applicantEmail,
        offerPricePcm: offerPrice.trim() === "" ? null : Number(offerPrice),
      });
      if (res.ok) setDoneRef(res.bookingReference);
      else setError(res.error);
    });
  };

  if (doneRef) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold">Booking form sent</p>
            <p className="mt-0.5 text-emerald-800">
              We&apos;ve emailed the form to <span className="font-medium">{applicantEmail}</span>.
              Booking reference <span className="font-mono font-medium">{doneRef}</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-brand-fg transition hover:bg-brand-hover"
        title="Send a booking form to your applicant and propose an offer price for this unit"
      >
        <Send className="h-4 w-4" />
        Send booking form
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-inset/40 py-6 text-sm text-foreground-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading booking forms…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{loadError}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface-inset/40 p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold text-foreground">Send a booking form</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="sbf-agent-name" className={labelCls}>Your name</label>
          <input
            id="sbf-agent-name"
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Agent name"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sbf-agent-email" className={labelCls}>Your email</label>
          <input
            id="sbf-agent-email"
            type="email"
            value={agentEmail}
            onChange={(e) => setAgentEmail(e.target.value)}
            placeholder="you@agency.com"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sbf-applicant-name" className={labelCls}>Applicant name</label>
          <input
            id="sbf-applicant-name"
            type="text"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            placeholder="Applicant name"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sbf-applicant-email" className={labelCls}>Applicant email</label>
          <input
            id="sbf-applicant-email"
            type="email"
            value={applicantEmail}
            onChange={(e) => setApplicantEmail(e.target.value)}
            placeholder="applicant@example.com"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sbf-offer" className={labelCls} title="The monthly rent you're proposing for this unit">
            Offer price (£ pcm)
          </label>
          <input
            id="sbf-offer"
            type="number"
            inputMode="numeric"
            min={minPrice ?? 0}
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            placeholder={minPrice != null ? String(minPrice) : "Monthly rent"}
            className={fieldCls}
          />
          {rangeLabel && (
            <p className="text-[11px] text-foreground-muted">Listed at {rangeLabel}.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sbf-form" className={labelCls}>Form to send</label>
          <select
            id="sbf-form"
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            className={fieldCls}
          >
            {forms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Holding deposit preview (≈ 1 week's rent) — mirrors the applicant form. */}
      <div className="rounded-xl border border-border bg-surface-card px-4 py-2.5">
        <span className={labelCls}>Holding deposit (1 week)</span>
        <p className="mt-1 text-sm font-medium text-foreground">
          {holdingDeposit != null
            ? `£${holdingDeposit.toLocaleString("en-GB")}`
            : "Enter an offer to calculate"}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-hover disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {isPending ? "Sending…" : "Send booking form"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="rounded-2xl border border-border bg-surface-card px-4 py-2.5 text-sm font-medium text-foreground-secondary transition hover:text-foreground disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
