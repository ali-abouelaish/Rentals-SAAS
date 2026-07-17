"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  DoorOpen,
  Loader2,
  MapPin,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  SupportActiveTicket,
  SupportPmTenant,
  SupportPrefill,
  SupportProperty,
} from "../domain/types";
import { ChatWindow } from "./ChatWindow";

type Step = "select_property" | "select_unit" | "select_tenant" | "ready" | "chatting";

interface Props {
  company: { id: string; name: string; slug: string };
  properties: SupportProperty[];
  companySlugParam: string | null;
  /** Set for renters arriving from the tenant portal — identity is already
   *  verified, so the selection steps are skipped. */
  prefill?: SupportPrefill | null;
}

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

function apiPath(path: string, slug: string | null): string {
  if (!slug) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}companySlug=${encodeURIComponent(slug)}`;
}

function priorityBadge(priority: SupportActiveTicket["priority"]) {
  const map: Record<SupportActiveTicket["priority"], string> = {
    critical: "bg-red-50 text-red-700 ring-red-200",
    high: "bg-orange-50 text-orange-700 ring-orange-200",
    medium: "bg-blue-50 text-blue-700 ring-blue-200",
    low: "bg-slate-50 text-slate-600 ring-slate-200",
  };
  return map[priority];
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || first.toUpperCase();
}

const stepIndex: Record<Step, number> = {
  select_property: 0,
  select_unit: 1,
  select_tenant: 2,
  ready: 3,
  chatting: 3,
};

const stepPrompts: Record<Exclude<Step, "chatting" | "ready">, { eyebrow: string; title: string; sub: string }> = {
  select_property: {
    eyebrow: "Step one",
    title: "Where's the issue?",
    sub: "Pick the property so we know which home we're helping with.",
  },
  select_unit: {
    eyebrow: "Step two",
    title: "Which room?",
    sub: "This helps us pull the right make, model and quirks.",
  },
  select_tenant: {
    eyebrow: "Step three",
    title: "And you are?",
    sub: "Just so we greet you properly and email the right person.",
  },
};

export function SupportExperience({ company, properties, companySlugParam, prefill }: Props) {
  const [step, setStep] = useState<Step>(prefill ? "ready" : "select_property");
  const [propertyId, setPropertyId] = useState<string>(prefill?.property.id ?? "");
  const [unitId, setUnitId] = useState<string>(prefill?.unitId ?? "");
  const [pmTenantId, setPmTenantId] = useState<string>(prefill?.tenant.id ?? "");

  const [unitTenants, setUnitTenants] = useState<SupportPmTenant[]>(
    prefill ? [prefill.tenant] : []
  );
  const [tenantsLoading, setTenantsLoading] = useState(false);

  const [activeTickets, setActiveTickets] = useState<SupportActiveTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialGreeting, setInitialGreeting] = useState<string>("");
  const [startingChat, setStartingChat] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const allProperties = useMemo(
    () => (prefill ? [prefill.property, ...properties] : properties),
    [prefill, properties]
  );

  const selectedProperty = useMemo(
    () => allProperties.find((p) => p.id === propertyId) ?? null,
    [allProperties, propertyId]
  );
  const selectedUnit = useMemo(
    () => selectedProperty?.units.find((u) => u.id === unitId) ?? null,
    [selectedProperty, unitId]
  );
  const selectedTenant = useMemo(
    () => unitTenants.find((t) => t.id === pmTenantId) ?? null,
    [unitTenants, pmTenantId]
  );

  async function loadTenantsForUnit(nextUnitId: string) {
    setTenantsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        apiPath(`/api/support/tenants?unitId=${encodeURIComponent(nextUnitId)}`, companySlugParam)
      );
      if (!res.ok) throw new Error("Failed to load tenants");
      const body = (await res.json()) as { tenants: SupportPmTenant[] };
      setUnitTenants(body.tenants);
    } catch (err) {
      console.error(err);
      setError("Couldn't load tenants for this unit. Please try again.");
      setUnitTenants([]);
    } finally {
      setTenantsLoading(false);
    }
  }

  async function startChat() {
    if (!propertyId || !unitId || !pmTenantId || startingChat) return;
    setStartingChat(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/support/conversations", companySlugParam), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, unitId, pmTenantId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { conversationId: string; greeting: string };
      setConversationId(body.conversationId);
      setInitialGreeting(body.greeting);
      setStep("chatting");
    } catch (err) {
      console.error(err);
      setError("Couldn't start the chat. Please try again.");
    } finally {
      setStartingChat(false);
    }
  }

  async function loadActiveTickets(nextPmTenantId: string) {
    setTicketsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        apiPath(
          `/api/support/active-tickets?tenantId=${encodeURIComponent(nextPmTenantId)}`,
          companySlugParam
        )
      );
      if (!res.ok) throw new Error("Failed to load tickets");
      const body = (await res.json()) as { tickets: SupportActiveTicket[] };
      setActiveTickets(body.tickets);
    } catch (err) {
      console.error(err);
      setError("Couldn't load your active requests.");
      setActiveTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }

  // Load the prefilled renter's open tickets on mount (normally triggered by
  // the name-confirmation click they skipped).
  useEffect(() => {
    if (prefill) void loadActiveTickets(prefill.tenant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (allProperties.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-surface-card p-10 text-center shadow-sm">
        <h1
          className="text-2xl leading-tight tracking-[-0.01em]"
          style={{ ...SERIF, fontWeight: 500 }}
        >
          No active tenancies
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-foreground-secondary">
          We can't find a current tenancy for {company.name} at the moment. If you're a
          tenant right now, please contact your landlord directly.
        </p>
      </div>
    );
  }

  function goBack() {
    setError(null);
    if (step === "select_unit") {
      setStep("select_property");
      setPropertyId("");
    } else if (step === "select_tenant") {
      setStep("select_unit");
      setUnitId("");
      setUnitTenants([]);
    } else if (step === "ready") {
      setStep("select_tenant");
      setPmTenantId("");
      setActiveTickets([]);
    }
  }

  const currentStepIdx = stepIndex[step];

  return (
    <div className="space-y-8">
      {/* Renters arriving from the tenant portal get a way back to it. */}
      {prefill && (
        <div>
          <a
            href={`/portal${
              companySlugParam
                ? `?companySlug=${encodeURIComponent(companySlugParam)}`
                : ""
            }`}
            className="group inline-flex items-center gap-1.5 text-xs font-medium text-foreground-secondary transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
            Back to your portal
          </a>
        </div>
      )}

      {step !== "chatting" && !prefill && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i < currentStepIdx
                    ? "w-6 bg-brand"
                    : i === currentStepIdx
                      ? "w-10 bg-brand"
                      : "w-6 bg-border"
                }`}
              />
            ))}
          </div>
          {(step === "select_unit" || step === "select_tenant" || step === "ready") && (
            <button
              type="button"
              onClick={goBack}
              className="group inline-flex items-center gap-1.5 text-xs font-medium text-foreground-secondary transition hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
              Back
            </button>
          )}
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-error-border bg-error-bg px-4 py-3 text-sm text-error-fg"
        >
          {error}
        </motion.div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {step === "select_property" && (
          <motion.section
            key="select_property"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <StepHeader {...stepPrompts.select_property} icon={<MapPin className="h-3.5 w-3.5" />} />
            <CardList>
              {allProperties.map((p, idx) => (
                <SelectionCard
                  key={p.id}
                  index={idx}
                  onClick={() => {
                    setPropertyId(p.id);
                    setUnitId("");
                    setPmTenantId("");
                    setUnitTenants([]);
                    setActiveTickets([]);
                    setStep("select_unit");
                  }}
                  label={p.name}
                  hint={p.address}
                  leading={
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-subtle">
                      <MapPin className="h-5 w-5 text-brand" />
                    </div>
                  }
                />
              ))}
            </CardList>
          </motion.section>
        )}

        {step === "select_unit" && selectedProperty && (
          <motion.section
            key="select_unit"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <StepHeader {...stepPrompts.select_unit} icon={<DoorOpen className="h-3.5 w-3.5" />} />
            <div className="mb-4 rounded-2xl border border-border bg-surface-card/70 px-4 py-3 text-xs text-foreground-secondary backdrop-blur">
              <span className="text-foreground-muted">Property · </span>
              {selectedProperty.name}
            </div>
            <CardList>
              {selectedProperty.units.map((u, idx) => (
                <SelectionCard
                  key={u.id}
                  index={idx}
                  onClick={() => {
                    setUnitId(u.id);
                    setPmTenantId("");
                    setUnitTenants([]);
                    setActiveTickets([]);
                    setStep("select_tenant");
                    void loadTenantsForUnit(u.id);
                  }}
                  label={u.label}
                  leading={
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-subtle">
                      <DoorOpen className="h-5 w-5 text-brand" />
                    </div>
                  }
                />
              ))}
            </CardList>
          </motion.section>
        )}

        {step === "select_tenant" && (
          <motion.section
            key="select_tenant"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <StepHeader {...stepPrompts.select_tenant} icon={<UserRound className="h-3.5 w-3.5" />} />
            {tenantsLoading ? (
              <SkeletonList />
            ) : unitTenants.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface-card p-6 text-center text-sm text-foreground-secondary">
                No active tenant on record for this unit. Please contact your landlord.
              </div>
            ) : (
              <CardList>
                {unitTenants.map((t, idx) => (
                  <SelectionCard
                    key={t.id}
                    index={idx}
                    onClick={() => {
                      setPmTenantId(t.id);
                      setActiveTickets([]);
                      setStep("ready");
                      void loadActiveTickets(t.id);
                    }}
                    label={t.fullName}
                    hint="Confirm your name"
                    leading={
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-brand-fg"
                        style={{ background: "var(--brand-primary)" }}
                      >
                        {initialsOf(t.fullName)}
                      </div>
                    }
                  />
                ))}
              </CardList>
            )}
          </motion.section>
        )}

        {step === "ready" && selectedTenant && (
          <motion.section
            key="ready"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
            className="space-y-6"
          >
            <div
              className="relative overflow-hidden rounded-3xl border border-border bg-surface-card p-6 shadow-sm"
              style={{
                backgroundImage:
                  "radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--brand-primary) 10%, transparent), transparent 55%)",
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-[0.95rem] font-semibold text-brand-fg"
                  style={{ background: "var(--brand-primary)" }}
                >
                  {initialsOf(selectedTenant.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                    Hello there
                  </p>
                  <p
                    className="mt-0.5 text-[1.4rem] leading-tight tracking-[-0.01em] text-foreground"
                    style={{ ...SERIF, fontWeight: 500 }}
                  >
                    {selectedTenant.fullName}
                  </p>
                  <p className="mt-1 text-xs text-foreground-secondary">
                    {selectedProperty?.name} · {selectedUnit?.label}
                  </p>
                </div>
              </div>
            </div>

            {ticketsLoading ? (
              <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking for existing requests…
              </div>
            ) : activeTickets.length > 0 ? (
              <section className="rounded-3xl border border-border bg-surface-card p-5 shadow-sm">
                <div className="mb-3 flex items-baseline justify-between">
                  <p
                    className="text-[1.05rem] tracking-[-0.005em] text-foreground"
                    style={{ ...SERIF, fontWeight: 500 }}
                  >
                    Your open requests
                  </p>
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                    {activeTickets.length} active
                  </span>
                </div>
                <ul className="space-y-2">
                  {activeTickets.map((t) => (
                    <li
                      key={t.reference}
                      className="rounded-2xl bg-surface-inset/50 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-foreground-muted">
                              {t.reference}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${priorityBadge(t.priority)}`}
                            >
                              {t.priority}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-foreground">
                            {t.descriptionPreview}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs capitalize text-foreground-secondary">
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {t.updates.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                            Updates from {company.name}
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
                                {u.authorName} ·{" "}
                                {new Date(u.createdAt).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <button
              type="button"
              onClick={() => void startChat()}
              disabled={startingChat}
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
                    {startingChat ? "Starting…" : "Begin troubleshooting"}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/70">
                    Most issues get solved right here, no callout needed.
                  </span>
                </span>
              </span>
              {startingChat ? (
                <Loader2 className="relative h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
              )}
            </button>
          </motion.section>
        )}

        {step === "chatting" && conversationId && selectedTenant && selectedProperty && selectedUnit && (
          <motion.section
            key="chatting"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <ChatWindow
              conversationId={conversationId}
              initialMessages={[{ role: "assistant", content: initialGreeting }]}
              apiPath={(path) => apiPath(path, companySlugParam)}
              contextBar={{
                tenantName: selectedTenant.fullName,
                initials: initialsOf(selectedTenant.fullName),
                propertyName: selectedProperty.name,
                unitLabel: selectedUnit.label,
              }}
            />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepHeader({
  eyebrow,
  title,
  sub,
  icon,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-secondary backdrop-blur">
        <span className="text-brand">{icon}</span>
        {eyebrow}
      </div>
      <h1
        className="text-[2rem] leading-[1.1] tracking-[-0.02em] text-foreground"
        style={{ ...SERIF, fontWeight: 500 }}
      >
        {title}
      </h1>
      <p className="mt-2 text-sm text-foreground-secondary">{sub}</p>
    </div>
  );
}

function CardList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2.5">{children}</ul>;
}

function SelectionCard({
  index,
  label,
  hint,
  leading,
  onClick,
}: {
  index: number;
  label: string;
  hint?: string;
  leading?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.04, ease: "easeOut" }}
    >
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface-card p-4 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
      >
        {leading}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.95rem] font-medium text-foreground">{label}</p>
          {hint && (
            <p className="mt-0.5 truncate text-xs text-foreground-secondary">{hint}</p>
          )}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-inset/70 text-foreground-secondary transition-all group-hover:bg-brand group-hover:text-brand-fg">
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </motion.li>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-4 rounded-2xl border border-border bg-surface-card p-4"
        >
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-surface-inset" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-inset" />
            <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-surface-inset" />
          </div>
        </li>
      ))}
    </ul>
  );
}

