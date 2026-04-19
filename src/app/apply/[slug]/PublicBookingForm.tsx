"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Home,
  Info as InfoIcon,
  Landmark,
  Loader2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { submitBookingForm } from "@/features/booking-forms/actions/form-responses";
import type { BookingForm, FormQuestion, TenantBankDetails } from "@/features/booking-forms/domain/types";
import type { PublicUnitForBooking } from "@/features/booking-forms/data/public-unit";

interface PublicBookingFormProps {
  form: BookingForm;
  slug: string;
  unit: PublicUnitForBooking;
  bankDetails: TenantBankDetails | null;
}

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

function formatUnitLabel(unit: PublicUnitForBooking): string {
  if (unit.unit_type === "room") {
    const roomLabel = unit.room_type
      ? unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)
      : "Room";
    return unit.room_number ? `Room ${unit.room_number} · ${roomLabel}` : roomLabel;
  }
  if (unit.unit_type === "studio") return "Studio";
  return "Whole flat";
}

function formatGBP(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined) return null;
  return `£${amount.toLocaleString("en-GB")}`;
}

const inputCls =
  "h-11 w-full rounded-2xl border border-border bg-surface-card px-4 text-sm text-foreground placeholder:text-foreground-muted shadow-xs transition focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

const textareaCls =
  "w-full rounded-2xl border border-border bg-surface-card px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted shadow-xs transition focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  switch (question.question_type) {
    case "textarea":
      return (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${textareaCls} resize-none`}
        />
      );
    case "select":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="">Select an option…</option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-2xl border border-border bg-surface-card px-4 py-3 text-sm text-foreground shadow-xs transition hover:border-brand/40">
          <input
            type="checkbox"
            checked={value === "yes"}
            onChange={(e) => onChange(e.target.checked ? "yes" : "no")}
            className="h-4 w-4 rounded border-border accent-brand"
          />
          Yes
        </label>
      );
    case "date":
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    case "number":
      return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    case "email":
      return <input type="email" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    case "phone":
      return <input type="tel" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    default:
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
  }
}

function Eyebrow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-secondary backdrop-blur">
      <span className="text-brand">{icon}</span>
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  sub,
  icon,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-3">
        <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      </div>
      <h2
        className="text-[1.35rem] leading-[1.15] tracking-[-0.01em] text-foreground"
        style={{ ...SERIF, fontWeight: 500 }}
      >
        {title}
      </h2>
      {sub && <p className="mt-1 text-sm text-foreground-secondary">{sub}</p>}
    </div>
  );
}

export function PublicBookingForm({ form, slug, unit, bankDetails }: PublicBookingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const items = [...(form.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const answerableQuestions = items.filter((q) => q.question_type !== "info");
  const hasAnyItems = items.length > 0;

  const property = unit.property;
  const addressLines = property
    ? [property.address_line_1, property.address_line_2, property.postcode].filter(Boolean)
    : [];
  const rentLabel = formatGBP(unit.min_price_pcm);
  const holdingDepositLabel = formatGBP(unit.holding_deposit);

  const hasAnyBank =
    bankDetails &&
    (bankDetails.account_holder_name ||
      bankDetails.account_number ||
      bankDetails.sort_code ||
      bankDetails.bank_name);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill in your name, email and phone number.");
      return;
    }

    startTransition(async () => {
      try {
        const answerPayload = answerableQuestions.map((q) => ({
          question_id: q.id,
          answer_text: answers[q.id] ?? "",
        }));

        await submitBookingForm(
          slug,
          {
            unit_id: unit.id,
            applicant_name: name.trim(),
            applicant_email: email.trim(),
            applicant_phone: phone.trim(),
          },
          answerPayload
        );
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
      }
    });
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface-card p-10 text-center shadow-sm"
        style={{
          backgroundImage:
            "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--brand-primary) 12%, transparent), transparent 55%)",
        }}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="mb-3 flex justify-center">
          <Eyebrow icon={<Sparkles className="h-3.5 w-3.5" />}>Application received</Eyebrow>
        </div>
        <h2
          className="text-[2rem] leading-[1.1] tracking-[-0.02em] text-foreground"
          style={{ ...SERIF, fontWeight: 500 }}
        >
          Thanks, we've got it.
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-foreground-secondary">
          Someone from the lettings team will be in touch shortly about next steps for{" "}
          <span className="text-foreground">{formatUnitLabel(unit)}</span>.
        </p>
        {holdingDepositLabel && hasAnyBank && (
          <p className="mx-auto mt-2 max-w-sm text-xs text-foreground-muted">
            Once accepted, you'll transfer {holdingDepositLabel} to the account shown earlier.
          </p>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
      className="space-y-8"
    >
      {/* ── Form intro ── */}
      <div>
        <h1
          className="text-[2.2rem] leading-[1.05] tracking-[-0.02em] text-foreground"
          style={{ ...SERIF, fontWeight: 500 }}
        >
          {form.name}
        </h1>
        {form.description && (
          <p className="mt-3 text-sm text-foreground-secondary">{form.description}</p>
        )}
      </div>

      {/* ── Hero room card ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 0.61, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface-card p-6 shadow-sm"
        style={{
          backgroundImage:
            "radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--brand-primary) 10%, transparent), transparent 55%)",
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
            <Home className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
              You're applying for
            </p>
            <p
              className="mt-0.5 text-[1.4rem] leading-tight tracking-[-0.01em] text-foreground"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              {formatUnitLabel(unit)}
            </p>
            {addressLines.length > 0 && (
              <p className="mt-1 text-sm text-foreground-secondary">
                {addressLines.join(", ")}
              </p>
            )}
          </div>
        </div>

        {(rentLabel || holdingDepositLabel) && (
          <div className="relative mt-5 grid grid-cols-2 gap-3">
            {rentLabel && (
              <div className="rounded-2xl bg-surface-inset/50 p-3.5">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Monthly rent
                </span>
                <p
                  className="mt-1 text-[1.15rem] leading-none tracking-[-0.005em] text-foreground"
                  style={{ ...SERIF, fontWeight: 500 }}
                >
                  {rentLabel}
                  <span className="ml-1 text-xs font-normal text-foreground-secondary" style={{ fontFamily: "inherit" }}>
                    pcm
                  </span>
                </p>
              </div>
            )}
            {holdingDepositLabel && (
              <div className="rounded-2xl bg-surface-inset/50 p-3.5">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Holding deposit
                </span>
                <p
                  className="mt-1 text-[1.15rem] leading-none tracking-[-0.005em] text-foreground"
                  style={{ ...SERIF, fontWeight: 500 }}
                >
                  {holdingDepositLabel}
                </p>
                <p className="mt-1 text-[11px] text-foreground-muted">
                  Usually about 1 week&apos;s rent
                </p>
              </div>
            )}
          </div>
        )}
      </motion.section>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Your details ── */}
        <section>
          <SectionHeader
            eyebrow="Step one"
            title="Your details"
            sub="So we know who we're speaking with."
            icon={<UserRound className="h-3.5 w-3.5" />}
          />
          <div className="rounded-3xl border border-border bg-surface-card p-5 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-[0.14em] text-foreground-muted">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
                placeholder="Jane Smith"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputCls}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className={inputCls}
                  placeholder="+44 7000 000000"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Dynamic questions + admin-authored info blocks, in order ── */}
        {hasAnyItems && (
          <section>
            <SectionHeader
              eyebrow="Step two"
              title={answerableQuestions.length > 0 ? "A few quick questions" : "A few things to know"}
              sub={
                answerableQuestions.length > 0
                  ? "Helps us match you to the right home."
                  : undefined
              }
              icon={<ClipboardList className="h-3.5 w-3.5" />}
            />
            <div className="rounded-3xl border border-border bg-surface-card p-5 shadow-sm space-y-5">
              {items.map((item) =>
                item.question_type === "info" ? (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-2xl border border-dashed border-brand/30 bg-brand/[0.04] p-4"
                  >
                    <InfoIcon className="h-4 w-4 text-brand mt-0.5 shrink-0" />
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {item.question_text}
                    </p>
                  </div>
                ) : (
                  <div key={item.id} className="space-y-1.5">
                    <label className="block text-xs font-medium uppercase tracking-[0.14em] text-foreground-muted">
                      {item.question_text}
                      {item.is_required && <span className="ml-1 text-red-500">*</span>}
                    </label>
                    <QuestionInput
                      question={item}
                      value={answers[item.id] ?? ""}
                      onChange={(v) => setAnswers((prev) => ({ ...prev, [item.id]: v }))}
                    />
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* ── Bank details ── */}
        {hasAnyBank && (
          <section>
            <SectionHeader
              eyebrow={hasAnyItems ? "Step three" : "Step two"}
              title="Where to pay your holding deposit"
              sub={
                holdingDepositLabel
                  ? `Once your application is accepted, you'll transfer ${holdingDepositLabel} to this account to secure the room.`
                  : "Once your application is accepted, you'll transfer the holding deposit to this account to secure the room."
              }
              icon={<Landmark className="h-3.5 w-3.5" />}
            />
            <div className="rounded-3xl border border-border bg-surface-card p-5 shadow-sm">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {bankDetails?.account_holder_name && (
                  <div className="rounded-2xl bg-surface-inset/50 p-3.5">
                    <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                      Account holder
                    </dt>
                    <dd className="mt-1 text-sm text-foreground">{bankDetails.account_holder_name}</dd>
                  </div>
                )}
                {bankDetails?.bank_name && (
                  <div className="rounded-2xl bg-surface-inset/50 p-3.5">
                    <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                      Bank
                    </dt>
                    <dd className="mt-1 text-sm text-foreground">{bankDetails.bank_name}</dd>
                  </div>
                )}
                {bankDetails?.sort_code && (
                  <div className="rounded-2xl bg-surface-inset/50 p-3.5">
                    <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                      Sort code
                    </dt>
                    <dd className="mt-1 font-mono text-sm text-foreground">{bankDetails.sort_code}</dd>
                  </div>
                )}
                {bankDetails?.account_number && (
                  <div className="rounded-2xl bg-surface-inset/50 p-3.5">
                    <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                      Account number
                    </dt>
                    <dd className="mt-1 font-mono text-sm text-foreground">{bankDetails.account_number}</dd>
                  </div>
                )}
              </dl>
              {bankDetails?.payment_reference_hint && (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-dashed border-border bg-surface-inset/30 p-3.5">
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                    Ref
                  </span>
                  <p className="text-xs text-foreground-secondary">
                    {bankDetails.payment_reference_hint}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-2xl border border-error-border bg-error-bg px-4 py-3 text-sm text-error-fg"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CTA ── */}
        <button
          type="submit"
          disabled={isPending}
          className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl px-6 py-5 text-left text-brand-fg shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)] transition-all hover:shadow-[0_14px_36px_-10px_rgba(0,0,0,0.28)] disabled:opacity-70"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-primary) 0%, color-mix(in oklab, var(--brand-primary) 75%, black) 100%)",
          }}
        >
          <span
            aria-hidden
            className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-60"
            style={{ background: "color-mix(in oklab, var(--brand-accent) 70%, transparent)" }}
          />
          <span className="relative flex items-center gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <span
                className="block text-[1.15rem] leading-tight tracking-[-0.005em]"
                style={{ ...SERIF, fontWeight: 500 }}
              >
                {isPending ? "Sending…" : "Submit application"}
              </span>
              <span className="mt-0.5 block text-xs text-white/70">
                We'll review and be in touch within one working day.
              </span>
            </span>
          </span>
          {isPending ? (
            <Loader2 className="relative h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
          )}
        </button>

        <p className="text-center text-xs text-foreground-muted">
          By submitting, you consent to us processing your data for your rental application.
        </p>
      </form>
    </motion.div>
  );
}
