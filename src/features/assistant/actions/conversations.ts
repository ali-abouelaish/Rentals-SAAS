"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertConversationAccess,
  createAssistantConversation,
  loadAssistantHistory,
  type AssistantMessage,
} from "../data/conversations";

/** Creates a fresh conversation and navigates to it. Used by the "New chat" button. */
export async function startNewChatAction(): Promise<void> {
  const { id } = await createAssistantConversation();
  revalidatePath("/assistant");
  redirect(`/assistant?c=${id}`);
}

/**
 * Resolves the floating mini chat's thread. Resumes the conversation id stored
 * in the caller's browser session when it is still accessible; otherwise (first
 * open this session, a stale id, or an explicit "New chat" passing null) it
 * creates a fresh conversation — so every browser session starts a clean chat.
 */
export async function openMiniAssistantThread(
  storedConversationId: string | null
): Promise<{ conversationId: string; messages: AssistantMessage[] }> {
  if (storedConversationId && (await assertConversationAccess(storedConversationId))) {
    const messages = await loadAssistantHistory(storedConversationId);
    return { conversationId: storedConversationId, messages };
  }

  const { id } = await createAssistantConversation();
  return { conversationId: id, messages: [] };
}
