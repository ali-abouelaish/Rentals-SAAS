"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAssistantConversation } from "../data/conversations";

/** Creates a fresh conversation and navigates to it. Used by the "New chat" button. */
export async function startNewChatAction(): Promise<void> {
  const { id } = await createAssistantConversation();
  revalidatePath("/assistant");
  redirect(`/assistant?c=${id}`);
}
