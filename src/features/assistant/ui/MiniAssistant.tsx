"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Loader2, AlertCircle, MessageSquarePlus } from "lucide-react";
import { AssistantChat } from "./AssistantChat";
import { openMiniAssistantThread } from "../actions/conversations";
import type { AssistantMessage } from "../data/conversations";

const MINI_GREETING =
  "Hi — ask me anything about your portfolio data, or how to use the app.";

/** Scopes the mini chat's conversation to the browser session: the first open
 * each session starts a fresh chat; reopens (incl. after reload) resume it. */
const SESSION_STORAGE_KEY = "mini-assistant-conversation-id";

type ThreadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; conversationId: string; messages: AssistantMessage[] }
  | { status: "error" };

/**
 * Floating AI launcher: a circular button in the bottom-right corner that opens
 * a mini chat overlay reusing the full AssistantChat (same streaming API and
 * conversation). The thread is provisioned lazily on first open: a fresh chat
 * per browser session, resumable within it, with a "New chat" control inside.
 */
export function MiniAssistant() {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ThreadState>({ status: "idle" });

  const load = useCallback(async (forceNew = false) => {
    setThread({ status: "loading" });
    try {
      const stored = forceNew ? null : window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      const { conversationId, messages } = await openMiniAssistantThread(stored);
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, conversationId);
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
            className="fixed bottom-[104px] right-[31px] z-50 flex h-[min(560px,calc(100dvh-9rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface-card shadow-[0_24px_70px_-30px_rgba(15,23,42,0.5)]"
          >
            {thread.status === "ready" && (
              <button
                type="button"
                onClick={() => void load(true)}
                aria-label="Start a new chat"
                title="New chat"
                className="absolute right-12 top-3 z-10 rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-surface-inset hover:text-foreground"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
            )}
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
                key={thread.conversationId}
                conversationId={thread.conversationId}
                initialMessages={thread.messages}
                greeting={MINI_GREETING}
                showStatus={false}
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
        className="fixed bottom-[31px] right-[31px] z-50 flex h-[61px] w-[61px] items-center justify-center rounded-full text-brand-fg shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-ground"
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
              <X className="h-[25px] w-[25px]" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Sparkles className="h-[25px] w-[25px]" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </>
  );
}
