"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, CheckCircle2, Phone, Ticket } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { TicketForm } from "./TicketForm";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Emergency = {
  type: string;
  number: string;
  tenantMessage: string;
  ticketReference?: string | null;
};

type ContextBar = {
  tenantName: string;
  initials: string;
  propertyName: string;
  unitLabel: string;
};

const EMERGENCY_LABEL: Record<string, string> = {
  gas: "Suspected gas leak",
  fire: "Fire or smoke",
  water: "Active flood or water leak",
  electric: "Electrical hazard",
  lockout: "Locked out",
  no_heat_cold: "No heating in cold weather",
};

interface Props {
  conversationId: string;
  initialMessages: ChatMessage[];
  apiPath: (path: string) => string;
  contextBar?: ContextBar;
}

const SOFT_NUDGE_TURN = 5;
const RAISE_TICKET_MIN_TURN = 3;

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

export function ChatWindow({
  conversationId,
  initialMessages,
  apiPath,
  contextBar,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [showNudge, setShowNudge] = useState(false);
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  // Keep the composer focused whenever the chat is in an input-accepting state.
  useEffect(() => {
    if (emergency || submittedReference || showTicketForm) return;
    textareaRef.current?.focus({ preventScroll: true });
  }, [messages, sending, emergency, submittedReference, showTicketForm, turnCount]);

  // Group consecutive messages from the same author so we can draw tails only on the last.
  const grouped = useMemo(() => {
    return messages.map((m, i) => {
      const next = messages[i + 1];
      const isLastOfRun = !next || next.role !== m.role;
      const prev = messages[i - 1];
      const isFirstOfRun = !prev || prev.role !== m.role;
      return { ...m, isLastOfRun, isFirstOfRun };
    });
  }, [messages]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setError(null);
    setSending(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const res = await fetch(
        apiPath(`/api/support/conversations/${conversationId}/messages`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        assistantMessage: string;
        turnCount: number;
        shouldSuggestTicket: boolean;
        emergency: Emergency | null;
      };

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: body.assistantMessage },
      ]);
      setTurnCount(body.turnCount);
      if (body.emergency) {
        setEmergency(body.emergency);
      } else if (body.shouldSuggestTicket && !showNudge) {
        setShowNudge(true);
      }
    } catch (err) {
      console.error(err);
      setError("Couldn't send your message — please try again.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(trimmed);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const canRaiseTicket =
    !emergency && !submittedReference && turnCount >= RAISE_TICKET_MIN_TURN;

  return (
    <div className="flex h-[640px] flex-col overflow-hidden rounded-3xl border border-border bg-surface-card shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]">
      {/* Context / header strip */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-card/70 px-5 py-3 backdrop-blur">
        {contextBar ? (
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-brand-fg"
              style={{ background: "var(--brand-primary)" }}
            >
              {contextBar.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.88rem] font-medium leading-tight text-foreground">
                {contextBar.tenantName}
              </p>
              <p className="truncate text-[11px] leading-tight text-foreground-muted">
                {contextBar.propertyName} · {contextBar.unitLabel}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-foreground">Maintenance chat</p>
        )}
      </div>

      {/* Emergency banner — dramatic, urgent, impossible to miss */}
      <AnimatePresence>
        {emergency && (
          <motion.div
            key="emergency"
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              className="relative border-b border-red-800 px-5 py-4 text-white"
              style={{
                background:
                  "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2), transparent 40%)",
                }}
              />
              <div className="relative flex items-start gap-3">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20"
                >
                  <AlertTriangle className="h-5 w-5" />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
                    Emergency · {EMERGENCY_LABEL[emergency.type] ?? emergency.type}
                  </p>
                  <a
                    href={`tel:${emergency.number.replace(/\s+/g, "")}`}
                    className="mt-1 inline-flex items-center gap-2 text-[1.4rem] leading-tight tracking-[-0.01em] text-white underline-offset-4 hover:underline"
                    style={{ ...SERIF, fontWeight: 500 }}
                  >
                    <Phone className="h-4 w-4" />
                    {emergency.number}
                  </a>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/90">
                    Please call this number now.{" "}
                    {emergency.ticketReference
                      ? `Priority ticket ${emergency.ticketReference} has been raised with your landlord.`
                      : "A priority ticket will be raised with your landlord."}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submitted confirmation */}
      <AnimatePresence>
        {submittedReference && (
          <motion.div
            key="submitted"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-3.5 text-emerald-800">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[1.05rem] leading-tight tracking-[-0.005em]"
                  style={{ ...SERIF, fontWeight: 500 }}
                >
                  Thank you — we've got it from here
                </p>
                <p className="mt-0.5 text-[12px] text-emerald-700/90">
                  Reference{" "}
                  <span className="font-mono text-emerald-900">{submittedReference}</span>
                  {" · "}
                  Your landlord has been notified and you'll get an email shortly.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-5 py-5"
        style={{
          background:
            "linear-gradient(180deg, var(--surface-card) 0%, color-mix(in oklab, var(--surface-ground) 70%, var(--surface-card)) 100%)",
        }}
      >
        <ul className="space-y-1.5">
          {grouped.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`flex ${isUser ? "justify-end" : "justify-start"} ${
                  m.isFirstOfRun ? "mt-3" : "mt-0.5"
                }`}
              >
                <div
                  className={`max-w-[84%] whitespace-pre-wrap break-words px-4 py-2.5 text-[14.5px] leading-relaxed ${
                    isUser
                      ? "bg-brand text-brand-fg shadow-sm"
                      : "bg-white text-foreground ring-1 ring-border"
                  }`}
                  style={{
                    borderRadius: isUser
                      ? `1.25rem 1.25rem ${m.isLastOfRun ? "0.4rem" : "1.25rem"} 1.25rem`
                      : `1.25rem 1.25rem 1.25rem ${m.isLastOfRun ? "0.4rem" : "1.25rem"}`,
                  }}
                >
                  {m.content}
                </div>
              </motion.li>
            );
          })}

          {sending && (
            <motion.li
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex justify-start"
            >
              <div className="flex items-center gap-1.5 rounded-[1.25rem] bg-white px-4 py-3 ring-1 ring-border">
                <TypingDot delay={0} />
                <TypingDot delay={0.15} />
                <TypingDot delay={0.3} />
              </div>
            </motion.li>
          )}

          {showNudge && turnCount >= SOFT_NUDGE_TURN && !submittedReference && !emergency && (
            <motion.li
              key="nudge"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 flex justify-center"
            >
              <div
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-card p-4 text-center shadow-sm"
                style={{
                  backgroundImage:
                    "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--brand-primary) 6%, transparent), transparent 60%)",
                }}
              >
                <p
                  className="text-[1rem] leading-tight tracking-[-0.005em] text-foreground"
                  style={{ ...SERIF, fontWeight: 500 }}
                >
                  Still tricky?
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-foreground-secondary">
                  When you're ready, we can send this to your landlord as a maintenance
                  request.
                </p>
                <button
                  type="button"
                  onClick={() => setShowTicketForm(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-brand-fg transition hover:opacity-90"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  Raise a ticket
                </button>
              </div>
            </motion.li>
          )}
        </ul>
      </div>

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Composer / footer state */}
      {emergency || submittedReference ? (
        <div className="flex items-center justify-center gap-2 border-t border-border bg-surface-card px-5 py-4 text-[12px] text-foreground-secondary">
          {emergency ? (
            <>
              <Phone className="h-3.5 w-3.5 text-red-600" />
              Chat paused — please make the call first. Your landlord will follow up.
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              This request has been sent to your landlord.
            </>
          )}
        </div>
      ) : (
        <div className="border-t border-border bg-surface-card px-4 pt-2.5 pb-3">
          <AnimatePresence initial={false}>
            {canRaiseTicket && (
              <motion.div
                key="raise-ticket-row"
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between pb-2">
                  <p className="text-[11px] text-foreground-muted">
                    Still not sorted?
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTicketForm(true)}
                    className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-card px-3 py-1 text-[11px] font-medium text-foreground transition hover:border-brand/40 hover:bg-brand-subtle hover:text-brand"
                  >
                    <Ticket className="h-3.5 w-3.5 transition group-hover:scale-110" />
                    Raise a ticket
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="flex min-h-[44px] flex-1 items-end rounded-2xl bg-surface-inset/60 px-4 py-2.5 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/20">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={(e) => {
                  // Re-focus unless focus moved into a modal or another interactive element
                  if (emergency || submittedReference || showTicketForm) return;
                  const next = e.relatedTarget as HTMLElement | null;
                  if (next && next.closest("[data-keep-focus]")) return;
                  requestAnimationFrame(() => {
                    textareaRef.current?.focus({ preventScroll: true });
                  });
                }}
                autoFocus
                rows={1}
                placeholder="Describe what's happening…"
                className="max-h-32 w-full resize-none border-none bg-transparent text-[14.5px] leading-relaxed text-foreground placeholder:text-foreground-muted focus:outline-none"
                disabled={sending}
              />
            </div>
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              data-keep-focus
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-fg shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              style={{ background: "var(--brand-primary)" }}
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </form>
        </div>
      )}

      {showTicketForm && (
        <TicketForm
          conversationId={conversationId}
          apiPath={apiPath}
          onClose={() => setShowTicketForm(false)}
          onSubmitted={(reference) => {
            setShowTicketForm(false);
            setSubmittedReference(reference);
          }}
        />
      )}
    </div>
  );
}

function TypingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="block h-1.5 w-1.5 rounded-full bg-foreground-muted"
      animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}
