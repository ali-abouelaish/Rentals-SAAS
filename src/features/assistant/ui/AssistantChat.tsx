"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { MarkdownMessage } from "./MarkdownMessage";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

interface Props {
  conversationId: string;
  initialMessages: ChatMessage[];
  greeting: string;
  suggestions?: string[];
  /** Overrides the root container's size/shape — used by the floating mini chat. */
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  "How many rooms are vacant right now?",
  "Who's behind on rent and by how much?",
  "Which contracts aren't deposit-protected?",
  "How many new leads came in today?",
];

export function AssistantChat({
  conversationId,
  initialMessages,
  greeting,
  suggestions = DEFAULT_SUGGESTIONS,
  className,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isEmpty = messages.length === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, [messages, sending]);

  const grouped = useMemo(() => {
    return messages.map((m, i) => {
      const next = messages[i + 1];
      const prev = messages[i - 1];
      return {
        ...m,
        isLastOfRun: !next || next.role !== m.role,
        isFirstOfRun: !prev || prev.role !== m.role,
      };
    });
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError(null);
    setSending(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    let assistantStarted = false;
    try {
      const res = await fetch(`/api/assistant/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { reason?: string } | null;
        throw new Error(body?.reason ?? "Couldn't get an answer — please try again.");
      }

      // Stream the answer in, appending tokens to a single assistant message.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (!acc) continue;
        if (!assistantStarted) {
          assistantStarted = true;
          setMessages((prev) => [...prev, { role: "assistant", content: acc }]);
        } else {
          setMessages((prev) => {
            const copy = prev.slice();
            copy[copy.length - 1] = { role: "assistant", content: acc };
            return copy;
          });
        }
      }
      if (!assistantStarted) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I didn't catch that — could you rephrase?" },
        ]);
      }
      // Refresh server components so the sidebar picks up the new title / ordering.
      // Client message state is preserved across a refresh.
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Couldn't get an answer — please try again.");
      // Roll back the optimistic user message (and the assistant placeholder if streaming had begun).
      setMessages((prev) => prev.slice(0, assistantStarted ? -2 : -1));
      setInput(trimmed);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div
      className={cn(
        "flex h-[calc((100vh-9rem)*0.9)] min-h-[468px] flex-col overflow-hidden rounded-3xl border border-border bg-surface-card shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-card/70 px-5 py-3 backdrop-blur">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/15">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9rem] font-semibold leading-tight text-foreground">AI Assistant</p>
          <p className="truncate text-[11px] leading-tight text-foreground-muted">
            Read-only answers about your portfolio data
          </p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Online
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-5 py-5"
        style={{
          background:
            "linear-gradient(180deg, var(--surface-card) 0%, color-mix(in oklab, var(--surface-ground) 70%, var(--surface-card)) 100%)",
        }}
      >
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mx-auto max-w-md py-8 text-center"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/15">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground-secondary">
              {greeting}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut", delay: 0.1 + i * 0.05 }}
                  onClick={() => void sendMessage(s)}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-card px-3.5 py-2.5 text-left text-[13px] text-foreground shadow-sm transition-all hover:border-brand/40 hover:bg-brand-subtle hover:text-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  <span>{s}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-brand opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <ul className="space-y-1.5">
          {grouped.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"} ${
                  m.isFirstOfRun ? "mt-3" : "mt-0.5"
                }`}
              >
                {!isUser &&
                  (m.isLastOfRun ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/15">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="h-7 w-7 shrink-0" aria-hidden />
                  ))}
                <div
                  className={`max-w-[80%] break-words px-4 py-2.5 text-[14.5px] leading-relaxed ${
                    isUser
                      ? "whitespace-pre-wrap bg-brand text-brand-fg shadow-sm"
                      : "bg-surface-card text-foreground shadow-sm ring-1 ring-border"
                  }`}
                  style={{
                    borderRadius: isUser
                      ? `1.25rem 1.25rem ${m.isLastOfRun ? "0.4rem" : "1.25rem"} 1.25rem`
                      : `1.25rem 1.25rem 1.25rem ${m.isLastOfRun ? "0.4rem" : "1.25rem"}`,
                  }}
                >
                  {isUser ? m.content : <MarkdownMessage content={m.content} />}
                </div>
              </motion.li>
            );
          })}

          {sending && grouped[grouped.length - 1]?.role !== "assistant" && (
            <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-end gap-2 justify-start">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/15">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-1.5 rounded-[1.25rem] rounded-bl-[0.4rem] bg-surface-card px-4 py-3 shadow-sm ring-1 ring-border">
                <TypingDot delay={0} />
                <TypingDot delay={0.15} />
                <TypingDot delay={0.3} />
              </div>
            </motion.li>
          )}
        </ul>
      </div>

      {error && (
        <div className="flex items-start gap-2 border-t border-red-200 bg-red-50 px-5 py-2.5 text-xs leading-relaxed text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
          <span>{error}</span>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border bg-surface-card px-4 pt-2.5 pb-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <div className="flex min-h-[44px] flex-1 items-end rounded-2xl bg-surface-inset/60 px-4 py-2.5 ring-1 ring-transparent transition focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-brand/25">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              rows={1}
              placeholder="Ask about properties, tenants, rent, finances…"
              className="max-h-32 w-full resize-none border-none bg-transparent text-[14.5px] leading-relaxed text-foreground placeholder:text-foreground-muted focus:outline-none"
              disabled={sending}
            />
          </div>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-fg shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            style={{ background: "var(--brand-primary)" }}
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </form>
        <p className="mt-1.5 px-1 text-[10.5px] text-foreground-muted">
          Read-only · answers reflect your data only · can make mistakes — verify important figures.
        </p>
      </div>
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
