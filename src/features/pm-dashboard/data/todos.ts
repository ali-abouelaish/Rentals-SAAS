import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PmTodo, TodoVisibility } from "../domain/todos";

// PostgREST embeds a to-one FK as an object, but generated types sometimes
// widen it to an array — normalise either shape to a single name.
type TodoRow = {
  id: string;
  title: string;
  due_date: string | null;
  property_id: string | null;
  visibility: string;
  is_done: boolean;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  created_by: string | null;
  creator_name: string;
  property?: { name: string } | { name: string }[] | null;
};

export function mapTodoRow(row: TodoRow): PmTodo {
  const prop = Array.isArray(row.property) ? row.property[0] : row.property;
  return {
    id: row.id,
    title: row.title,
    due_date: row.due_date,
    property_id: row.property_id,
    property_name: prop?.name ?? null,
    visibility: (row.visibility as TodoVisibility) ?? "personal",
    is_done: row.is_done,
    completed_at: row.completed_at,
    archived_at: row.archived_at,
    created_at: row.created_at,
    created_by: row.created_by,
    creator_name: row.creator_name,
  };
}

export const TODO_COLUMNS =
  "id, title, due_date, property_id, visibility, is_done, completed_at, archived_at, created_at, created_by, creator_name, property:properties(name)";

/** Most recently completed tasks are shown first in the audit view. */
const HISTORY_LIMIT = 50;

/**
 * Active todos visible to the current user (own personal + all team todos in the
 * tenant), open tasks first and soonest due first. Archived (cleared) tasks are
 * excluded — those live in the history/audit view. RLS enforces visibility.
 */
export async function getDashboardTodos(): Promise<PmTodo[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_todos")
    .select(TODO_COLUMNS)
    .is("archived_at", null)
    .order("is_done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapTodoRow(r as unknown as TodoRow));
}

/**
 * Audit trail of completed-and-cleared tasks, most recently completed first.
 * Read-only in the UI. RLS scopes this to the caller's own + team todos.
 */
export async function getTodoHistory(): Promise<PmTodo[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_todos")
    .select(TODO_COLUMNS)
    .not("archived_at", "is", null)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("archived_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapTodoRow(r as unknown as TodoRow));
}

/** Lightweight property list for the "link to a property" dropdown. */
export async function getTodoPropertyOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string }[];
}
