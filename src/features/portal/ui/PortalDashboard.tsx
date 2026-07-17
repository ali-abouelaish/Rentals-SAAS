import {
  Banknote,
  CalendarClock,
  ChevronDown,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { DEPOSIT_SCHEME_LABELS } from "@/features/contracts/domain/types";
import type {
  PortalDeposit,
  PortalPmTenant,
  PortalRentStatus,
  PortalTenancy,
  PortalTicket,
} from "../domain/types";
import { CopyReferenceButton } from "./CopyReferenceButton";

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

type TenancyBlock = {
  tenancy: PortalTenancy;
  rent: PortalRentStatus | null;
  deposit: PortalDeposit;
};

interface Props {
  agency: { name: string; email: string; phone: string | null };
  pmTenant: PortalPmTenant;
  blocks: TenancyBlock[];
  tickets: PortalTicket[];
  errorCode: string | null;
  /** "" in production; "?companySlug=x" on localhost. */
  slugSuffix: string;
}

function fmtGBP(amount: number): string {
  const hasPence = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: hasPence ? 2 : 0,
    maximumFractionDigits: hasPence ? 2 : 0,
  }).format(amount);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function fmtMonth(year: number, month1: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month1 - 1, 1)));
}

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function priorityBadge(priority: PortalTicket["priority"]): string {
  const map: Record<PortalTicket["priority"], string> = {
    critical: "bg-red-50 text-red-700 ring-red-200",
    high: "bg-orange-50 text-orange-700 ring-orange-200",
    medium: "bg-blue-50 text-blue-700 ring-blue-200",
    low: "bg-slate-50 text-slate-600 ring-slate-200",
  };
  return map[priority];
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-inset text-foreground-secondary">
        {icon}
      </span>
      <p
        className="text-[1.05rem] tracking-[-0.005em] text-foreground"
        style={{ ...SERIF, fontWeight: 500 }}
      >
        {children}
      </p>
    </div>
  );
}

function TenancyCard({ tenancy }: { tenancy: PortalTenancy }) {
  return (
    <section className="rounded-3xl border border-border bg-surface-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground-muted">
            {tenancy.ended ? "Previous tenancy" : "Your home"}
          </p>
          <p
            className="mt-1 text-[1.3rem] leading-tight tracking-[-0.01em] text-foreground"
            style={{ ...SERIF, fontWeight: 500 }}
          >
            {tenancy.propertyName}
          </p>
          <p className="mt-1 text-sm text-foreground-secondary">
            {tenancy.unitLabel}
            {tenancy.propertyAddress ? ` · ${tenancy.propertyAddress}` : ""}
          </p>
        </div>
        {tenancy.ended ? (
          <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200">
            Ended
          </span>
        ) : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-foreground-muted">Rent</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {fmtGBP(tenancy.rentPcm)} pcm
          </dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Rent day</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {tenancy.collectionDate
              ? `${ordinal(tenancy.collectionDate)} of the month`
              : "1st of the month"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Start</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {fmtDate(tenancy.startDate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">
            {tenancy.ended ? "Ended" : "Until"}
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {tenancy.expiryDate ? fmtDate(tenancy.expiryDate) : "Rolling"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function RentCard({
  tenancy,
  rent,
}: {
  tenancy: PortalTenancy;
  rent: PortalRentStatus;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-card p-5 shadow-sm">
      <SectionTitle icon={<Banknote className="h-4 w-4" />}>Rent</SectionTitle>

      <div className="flex flex-wrap items-center gap-2">
        {rent.currentMonthPaid ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            This month is paid
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            This month not yet received
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary">
          <CalendarClock className="h-4 w-4" />
          Next rent due {fmtDate(rent.nextDueDate)}
        </span>
      </div>

      {rent.arrears > 0 ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Our records show an outstanding balance of{" "}
          <strong>{fmtGBP(rent.arrears)}</strong>. If you think this is wrong,
          or you&apos;d like to arrange a payment plan, please get in touch —
          contact details are below.
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl bg-surface-inset/50 p-4">
        <p className="text-xs text-foreground-muted">
          Your payment reference — set it as the reference on your bank standing
          order so your payments are matched to your tenancy automatically.
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-lg font-semibold tracking-[0.08em] text-foreground">
            {tenancy.paymentReference}
          </span>
          <CopyReferenceButton value={tenancy.paymentReference} />
        </div>
      </div>

      {rent.payments.length > 0 ? (
        <details className="group mt-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground">
            Payment history ({rent.payments.length})
          </summary>
          <ul className="mt-3 space-y-1.5">
            {rent.payments.map((p) => (
              <li
                key={`${p.periodYear}-${p.periodMonth}`}
                className="flex items-center justify-between rounded-xl bg-surface-inset/50 px-3.5 py-2.5 text-sm"
              >
                <span className="text-foreground">
                  {fmtMonth(p.periodYear, p.periodMonth)}
                </span>
                <span className="text-foreground-secondary">
                  {fmtGBP(p.amount)} · paid {fmtDate(p.paidAt)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="mt-4 text-sm text-foreground-muted">
          No payments recorded yet.
        </p>
      )}
    </section>
  );
}

function DepositCard({ deposit }: { deposit: PortalDeposit }) {
  const statePill =
    deposit.state === "protected" ? (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
        Protected
      </span>
    ) : deposit.state === "pending" ? (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
        Protection in progress
      </span>
    ) : (
      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
        No scheme recorded
      </span>
    );

  return (
    <section className="rounded-3xl border border-border bg-surface-card p-5 shadow-sm">
      <SectionTitle icon={<ShieldCheck className="h-4 w-4" />}>
        Deposit
      </SectionTitle>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {fmtGBP(deposit.amount)}
        </span>
        {statePill}
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        {deposit.scheme !== "none" ? (
          <div className="flex justify-between gap-3">
            <dt className="text-foreground-muted">Scheme</dt>
            <dd className="text-right text-foreground">
              {DEPOSIT_SCHEME_LABELS[deposit.scheme]}
            </dd>
          </div>
        ) : null}
        {deposit.protectedDate ? (
          <div className="flex justify-between gap-3">
            <dt className="text-foreground-muted">Protected on</dt>
            <dd className="text-right text-foreground">
              {fmtDate(deposit.protectedDate)}
            </dd>
          </div>
        ) : null}
        {deposit.dan ? (
          <div className="flex justify-between gap-3">
            <dt className="text-foreground-muted">Deposit Account Number</dt>
            <dd className="text-right font-mono text-foreground">{deposit.dan}</dd>
          </div>
        ) : null}
        {deposit.dpsDepositId ? (
          <div className="flex justify-between gap-3">
            <dt className="text-foreground-muted">DPS deposit ID</dt>
            <dd className="text-right font-mono text-foreground">
              {deposit.dpsDepositId}
            </dd>
          </div>
        ) : null}
        {!deposit.dan && !deposit.dpsDepositId && deposit.schemeRef ? (
          <div className="flex justify-between gap-3">
            <dt className="text-foreground-muted">Scheme reference</dt>
            <dd className="text-right font-mono text-foreground">
              {deposit.schemeRef}
            </dd>
          </div>
        ) : null}
      </dl>

      {deposit.certificateUrl ? (
        <a
          href={deposit.certificateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-foreground-link underline-offset-4 hover:underline"
        >
          View your protection certificate
        </a>
      ) : null}

      {deposit.returned ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your deposit was returned
          {deposit.returnedAt ? ` on ${fmtDate(deposit.returnedAt)}` : ""}.
        </div>
      ) : null}
    </section>
  );
}

function MaintenanceCard({
  tickets,
  slugSuffix,
}: {
  tickets: PortalTicket[];
  slugSuffix: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={<Wrench className="h-4 w-4" />}>
          Maintenance
        </SectionTitle>
        <a
          href={`/portal/report${slugSuffix}`}
          className="mb-3 inline-flex items-center justify-center rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-fg shadow-sm transition-all hover:bg-accent-hover"
          title="Opens a chat with our maintenance assistant — it can often help you fix the issue right away, or raises a ticket for us if not"
        >
          Report a new issue
        </a>
      </div>

      {tickets.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          You haven&apos;t reported any issues yet. If something in your home
          needs attention, report it and we&apos;ll take it from there.
        </p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.reference}>
              {/* Collapsed by default; the summary row is the whole header. */}
              <details className="group rounded-2xl bg-surface-inset/50">
                <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3 p-3.5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-foreground-muted">
                        {t.reference}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${priorityBadge(t.priority)}`}
                      >
                        {t.priority}
                      </span>
                      {t.updates.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-card px-2 py-0.5 text-[10px] font-medium text-foreground-secondary ring-1 ring-inset ring-border">
                          <MessageSquare className="h-3 w-3" />
                          {t.updates.length}{" "}
                          {t.updates.length === 1 ? "update" : "updates"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-foreground">
                      {t.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs capitalize text-foreground-secondary">
                      {statusLabel(t.status)}
                    </span>
                    <ChevronDown className="h-4 w-4 text-foreground-muted transition-transform group-open:rotate-180" />
                  </div>
                </summary>

                <div className="border-t border-border/60 px-3.5 pb-3.5 pt-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {t.description}
                  </p>
                  <p className="mt-1.5 text-xs text-foreground-muted">
                    Reported {fmtDate(t.createdAt)}
                    {t.resolvedAt ? ` · resolved ${fmtDate(t.resolvedAt)}` : ""}
                  </p>

                  {t.updates.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                        Updates from your property manager
                      </p>
                      {t.updates.map((u, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-border bg-surface-card px-3 py-2.5"
                        >
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                            {u.body}
                          </p>
                          <p className="mt-1 text-[11px] text-foreground-muted">
                            {u.authorName} · {fmtDate(u.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-foreground-muted">
                      No updates from your property manager yet.
                    </p>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactCard({
  agency,
}: {
  agency: { name: string; email: string; phone: string | null };
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface-card p-5 shadow-sm">
      <SectionTitle icon={<Mail className="h-4 w-4" />}>
        Your property manager
      </SectionTitle>
      <p className="text-sm text-foreground-secondary">
        {agency.name} manages your tenancy. For anything the portal
        doesn&apos;t cover, get in touch:
      </p>
      <div className="mt-3 flex flex-col gap-2 text-sm">
        <a
          href={`mailto:${agency.email}`}
          className="inline-flex items-center gap-2 font-medium text-foreground-link underline-offset-4 hover:underline"
        >
          <Mail className="h-4 w-4" />
          {agency.email}
        </a>
        {agency.phone ? (
          <a
            href={`tel:${agency.phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-2 font-medium text-foreground-link underline-offset-4 hover:underline"
          >
            <Phone className="h-4 w-4" />
            {agency.phone}
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function PortalDashboard({
  agency,
  pmTenant,
  blocks,
  tickets,
  errorCode,
  slugSuffix,
}: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground-muted">
            Welcome back
          </p>
          <h1
            className="mt-1 text-[1.7rem] leading-tight tracking-[-0.01em] text-foreground"
            style={{ ...SERIF, fontWeight: 500 }}
          >
            Hi {pmTenant.firstName}
          </h1>
        </div>
        <form method="post" action={`/portal/logout${slugSuffix}`}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs font-medium text-foreground-secondary transition-colors hover:bg-surface-inset hover:text-foreground"
            title="Signs you out of the portal on this device"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>

      {errorCode === "no_unit" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          We couldn&apos;t find a current room or flat linked to you, so the
          issue reporter isn&apos;t available — please contact {agency.name}{" "}
          directly using the details below.
        </div>
      ) : null}

      {blocks.length === 0 ? (
        <section className="rounded-3xl border border-border bg-surface-card p-6 text-center shadow-sm">
          <p
            className="text-[1.2rem] text-foreground"
            style={{ ...SERIF, fontWeight: 500 }}
          >
            No tenancy on record
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-foreground-secondary">
            We couldn&apos;t find a tenancy linked to your account. If you think
            this is a mistake, contact {agency.name} using the details below.
          </p>
        </section>
      ) : (
        blocks.map((block) => (
          <div key={block.tenancy.contractId} className="space-y-4">
            <TenancyCard tenancy={block.tenancy} />
            {block.rent ? (
              <RentCard tenancy={block.tenancy} rent={block.rent} />
            ) : null}
            <DepositCard deposit={block.deposit} />
          </div>
        ))
      )}

      <MaintenanceCard tickets={tickets} slugSuffix={slugSuffix} />
      <ContactCard agency={agency} />
    </div>
  );
}
