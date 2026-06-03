import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import {
  getOrCreateAssistantConversation,
  listAssistantConversations,
  loadAssistantHistory,
  assertConversationAccess,
} from "@/features/assistant/data/conversations";
import { assistantGreeting } from "@/lib/ai/assistant";
import { AssistantChat } from "@/features/assistant/ui/AssistantChat";
import { ConversationSidebar } from "@/features/assistant/ui/ConversationSidebar";

export const dynamic = "force-dynamic";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams?: { c?: string };
}) {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const entitlements = await getEntitlements();
  if (!entitlements.has("ai_assistant")) {
    redirect("/dashboard?view=pm");
  }

  try {
    // Resolve the active conversation: the requested ?c= (if accessible),
    // otherwise the most recent one (created on first ever visit).
    const requested = searchParams?.c;
    const activeId =
      requested && (await assertConversationAccess(requested))
        ? requested
        : (await getOrCreateAssistantConversation()).id;

    const [history, conversations] = await Promise.all([
      loadAssistantHistory(activeId),
      listAssistantConversations(),
    ]);

    return (
      <div className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Sparkles className="h-6 w-6 text-brand" />
            AI Assistant
          </h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Ask questions about your properties, tenants, contracts, rent, finances, bookings and leads.
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <ConversationSidebar conversations={conversations} activeId={activeId} />
          <div className="min-w-0 flex-1">
            <AssistantChat
              key={activeId}
              conversationId={activeId}
              initialMessages={history}
              greeting={assistantGreeting()}
            />
          </div>
        </div>
      </div>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable = message.includes("schema cache") || message.includes("does not exist");

    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Assistant</h1>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
            <Sparkles className="h-7 w-7 text-brand" />
          </div>
          <p className="mb-2 text-sm font-semibold text-foreground">
            {isMissingTable ? "Database migrations pending" : "Failed to load the assistant"}
          </p>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-foreground-secondary">
            {isMissingTable
              ? "Apply the latest migrations in supabase/migrations/ to your Supabase database, then reload."
              : message}
          </p>
        </div>
      </div>
    );
  }
}
