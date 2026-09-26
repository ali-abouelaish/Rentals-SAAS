import { FileText, Lock, LifeBuoy, UserRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SupportAttachment, SupportMessage } from "../domain/types";
import { formatTicketTime } from "./badges";

function AttachmentList({ items }: { items: SupportAttachment[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((a) => (
        <li key={a.id} className="max-w-full">
          {a.signed_url ? (
            <a
              href={a.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs text-foreground-link hover:underline"
            >
              {a.mime_type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.signed_url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
              ) : (
                <FileText size={13} className="shrink-0" />
              )}
              <span className="truncate">{a.file_name}</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground-muted">
              <FileText size={13} /> {a.file_name} (unavailable)
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The original request followed by the thread. Presentational only — used by
 * both the agency page and the admin console. `viewer` flips which side is
 * "us": agency messages sit right for the agency, platform ones for us.
 * Internal notes only ever reach this component on the platform side (RLS
 * strips them for agencies), and render in amber so they can't be mistaken for
 * a reply.
 */
export function TicketConversation({
  viewer,
  openingAuthor,
  openingBody,
  openingAt,
  messages,
  attachments,
}: {
  viewer: "agency" | "platform";
  openingAuthor: string;
  openingBody: string;
  openingAt: string;
  messages: SupportMessage[];
  attachments: SupportAttachment[];
}) {
  const byMessage = new Map<string | null, SupportAttachment[]>();
  for (const a of attachments) {
    const key = a.message_id ?? null;
    byMessage.set(key, [...(byMessage.get(key) ?? []), a]);
  }

  const entries = [
    {
      id: "opening",
      author_name: openingAuthor,
      author_side: "agency" as const,
      is_internal: false,
      body: openingBody,
      created_at: openingAt,
      files: byMessage.get(null) ?? [],
    },
    ...messages.map((m) => ({ ...m, files: byMessage.get(m.id) ?? [] })),
  ];

  return (
    <ol className="space-y-3">
      {entries.map((m) => {
        const mine = m.author_side === viewer;
        const Icon = m.is_internal ? Lock : m.author_side === "platform" ? LifeBuoy : UserRound;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "w-full max-w-[min(100%,40rem)] rounded-xl p-3 ring-1 ring-inset",
                m.is_internal
                  ? "bg-amber-50 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30"
                  : mine
                    ? "bg-brand/5 ring-brand/20"
                    : "bg-surface-inset ring-border"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Icon size={13} className="shrink-0 text-foreground-muted" />
                <span className="text-xs font-semibold text-foreground">{m.author_name}</span>
                {m.is_internal && (
                  <span className="rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    Internal — agency can't see
                  </span>
                )}
                <span className="text-[11px] text-foreground-muted">{formatTicketTime(m.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground-secondary [overflow-wrap:anywhere]">
                {m.body}
              </p>
              <AttachmentList items={m.files} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
