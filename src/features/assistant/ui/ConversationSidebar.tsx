import Link from "next/link";
import { Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { startNewChatAction } from "../actions/conversations";
import type { AssistantConversationSummary } from "../data/conversations";

function relativeDay(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface Props {
  conversations: AssistantConversationSummary[];
  activeId: string;
}

export function ConversationSidebar({ conversations, activeId }: Props) {
  return (
    <aside className="flex max-h-72 flex-col overflow-hidden rounded-3xl border border-border bg-surface-card shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] lg:h-[calc((100vh-9rem)*0.9)] lg:max-h-none lg:w-72">
      {/* New chat */}
      <div className="border-b border-border p-3">
        <form action={startNewChatAction}>
          <Button type="submit" variant="secondary" size="md" className="w-full">
            <Plus className="h-4 w-4" />
            New chat
          </Button>
        </form>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
          Chats
        </p>
        {conversations.length === 0 ? (
          <p className="px-2 py-3 text-xs text-foreground-muted">No conversations yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => {
              const isActive = c.id === activeId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/assistant?c=${c.id}`}
                    className={cn(
                      "group flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors",
                      isActive
                        ? "bg-brand-subtle text-brand"
                        : "text-foreground-secondary hover:bg-surface-inset hover:text-foreground"
                    )}
                  >
                    <MessageSquare
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        isActive ? "text-brand" : "text-foreground-muted group-hover:text-foreground"
                      )}
                      strokeWidth={1.8}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium leading-tight">
                        {c.title ?? "New chat"}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-foreground-muted">
                        {relativeDay(c.updated_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
