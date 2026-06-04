"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAssistantConversation,
  getOrCreateAssistantConversation,
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
 * Resolves the caller's most recent assistant conversation (creating one only
 * if none exists) and returns it with its history. Called by the floating mini
 * chat on first open, so no conversation is created until the user opens it.
 */
export async function getOrCreateMiniAssistantThread(): Promise<{
  conversationId: string;
  messages: AssistantMessage[];
}> {
  const { id } = await getOrCreateAssistantConversation();
  const messages = await loadAssistantHistory(id);
  return { conversationId: id, messages };
}
