"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Loader2, AlertCircle } from "lucide-react";
import { AssistantChat } from "./AssistantChat";
import { getOrCreateMiniAssistantThread } from "../actions/conversations";
import type { AssistantMessage } from "../data/conversations";

const MINI_GREETING =
  "Hi — ask me anything about your portfolio data, or how to use the app.";

type ThreadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; conversationId: string; messages: AssistantMessage[] }
  | { status: "error" };

/**
 * Floating AI launcher: a circular button in the bottom-left corner that opens
 * a mini chat overlay reusing the full AssistantChat (same streaming API and
 * conversation). The thread is provisioned lazily on first open.
 */
export function MiniAssistant() {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ThreadState>({ status: "idle" });

  const load = useCallback(async () => {
    setThread({ status: "loading" });
    try {
      const { conversationId, messages } = await getOrCreateMiniAssistantThread();
      setThread({ status: "ready", conversationId, messages });
    } catch {
      setThread({ status: "error" });
    }
  }, []);

  // Provision the thread the first time the panel is opened.
  useEffect(() => {
    if (open && thread.status === "idle") void load();
  }, [open, thread.status, load]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="mini-assistant-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-label="AI assistant"
            className="fixed bottom-20 left-4 z-50 flex h-[min(560px,calc(100dvh-7rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface-card shadow-[0_24px_70px_-30px_rgba(15,23,42,0.5)] md:left-[276px]"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close AI assistant"
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-surface-inset hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {thread.status === "ready" ? (
              <AssistantChat
                conversationId={thread.conversationId}
                initialMessages={thread.messages}
                greeting={MINI_GREETING}
                className="h-full min-h-0 w-full rounded-2xl border-0 shadow-none"
              />
            ) : thread.status === "error" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <p className="text-sm text-foreground-secondary">
                  Couldn&apos;t open the assistant. Please try again.
                </p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-inset"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={open}
        className="fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full text-brand-fg shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-ground md:left-[276px]"
        style={{ background: "var(--brand-primary)" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Sparkles className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </>
  );
}
