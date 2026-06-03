import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantConversationSummary = {
  id: string;
  title: string | null;
  updated_at: string;
};

/** Lists the caller's conversations, most recently active first (RLS + created_by scoped). */
export async function listAssistantConversations(): Promise<AssistantConversationSummary[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("assistant_conversations")
    .select("id, title, updated_at")
    .eq("created_by", profile.id)
    .order("updated_at", { ascending: false });

  return (data ?? []) as AssistantConversationSummary[];
}

/** Always creates a fresh, empty conversation for the caller and returns its id. */
export async function createAssistantConversation(): Promise<{ id: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({ tenant_id: profile.tenant_id, created_by: profile.id })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create conversation");
  }
  return { id: data.id as string };
}

/**
 * Returns the caller's most recent assistant conversation, creating one if none
 * exists. Scoped to the tenant + the current admin via RLS + created_by.
 */
export async function getOrCreateAssistantConversation(): Promise<{ id: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("created_by", profile.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return { id: existing.id as string };

  const { data: created, error } = await supabase
    .from("assistant_conversations")
    .insert({ tenant_id: profile.tenant_id, created_by: profile.id })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create conversation");
  }
  return { id: created.id as string };
}

/** Confirms the conversation belongs to the caller's tenant (RLS-enforced). */
export async function assertConversationAccess(conversationId: string): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();
  return !!data;
}

export async function loadAssistantHistory(conversationId: string): Promise<AssistantMessage[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("assistant_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (data ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));
}

export async function appendAssistantMessage(args: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
}): Promise<void> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  await supabase.from("assistant_messages").insert({
    conversation_id: args.conversationId,
    tenant_id: profile.tenant_id,
    role: args.role,
    content: args.content,
  });

  // Title the conversation from its first user message. The `is("title", null)`
  // guard means this only ever sets the title once (the first user turn).
  if (args.role === "user") {
    const title = args.content.replace(/\s+/g, " ").trim().slice(0, 60);
    await supabase
      .from("assistant_conversations")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", args.conversationId)
      .is("title", null);
  }

  await supabase
    .from("assistant_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", args.conversationId);
}
