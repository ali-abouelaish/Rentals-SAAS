"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { TodoInputSchema } from "../domain/todos";
import { mapTodoRow, TODO_COLUMNS } from "../data/todos";
import type { PmTodo } from "../domain/todos";

type ActionError = { error: string };
type ActionOk = { success: true };

export async function createTodo(
  input: unknown
): Promise<ActionError | (ActionOk & { todo: PmTodo })> {
  const profile = await requireUserProfile();
  const parsed = TodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { title, due_date, property_id, visibility } = parsed.data;
  const supabase = createSupabaseServerClient();

  // Guard against linking a property from another tenant: the read is
  // RLS-scoped, so a foreign id simply won't be found.
  if (property_id) {
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", property_id)
      .maybeSingle();
    if (!prop) return { error: "Property not found" };
  }

  const creatorName = profile.display_name?.trim() || profile.email || "Staff";

  const { data, error } = await supabase
    .from("pm_todos")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      creator_name: creatorName,
      title,
      due_date: due_date ?? null,
      property_id: property_id ?? null,
      visibility,
    })
    .select(TODO_COLUMNS)
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true, todo: mapTodoRow(data as never) };
}

export async function toggleTodo(id: string, done: boolean): Promise<ActionError | ActionOk> {
  await requireUserProfile();
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid task id" };
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("pm_todos")
    .update({ is_done: done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTodo(id: string): Promise<ActionError | ActionOk> {
  await requireUserProfile();
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid task id" };
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("pm_todos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Clear every completed task off the active list by archiving it. The rows are
 * retained (not deleted) so they remain in the completed-task audit/history.
 * The daily cron job (src/lib/cron/archiveTodos.ts) does the same automatically.
 */
export async function clearCompletedTodos(): Promise<ActionError | ActionOk> {
  await requireUserProfile();
  const supabase = createSupabaseServerClient();

  // RLS restricts the update to the caller's own personal + team todos.
  const { error } = await supabase
    .from("pm_todos")
    .update({ archived_at: new Date().toISOString() })
    .eq("is_done", true)
    .is("archived_at", null);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
