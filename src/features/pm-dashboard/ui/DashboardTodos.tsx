"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ListTodo,
  Check,
  Trash2,
  CalendarDays,
  Building2,
  Users,
  Plus,
  History,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TodoInputSchema, type TodoInput, type PmTodo, type TodoVisibility } from "../domain/todos";
import { createTodo, toggleTodo, deleteTodo, clearCompletedTodos } from "../actions/todos";

interface DashboardTodosProps {
  todos: PmTodo[];
  setTodos: Dispatch<SetStateAction<PmTodo[]>>;
  initialHistory: PmTodo[];
  properties: { id: string; name: string }[];
}

export function DashboardTodos({ todos, setTodos, initialHistory, properties }: DashboardTodosProps) {
  const [history, setHistory] = useState<PmTodo[]>(initialHistory);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TodoInput>({
    resolver: zodResolver(TodoInputSchema),
    defaultValues: { title: "", due_date: "", property_id: "", visibility: "personal" },
  });

  const propertyId = watch("property_id") ?? "";
  const visibility = (watch("visibility") ?? "personal") as TodoVisibility;

  const open = todos.filter((t) => !t.is_done);
  const done = todos.filter((t) => t.is_done);

  async function onSubmit(values: TodoInput) {
    const result = await createTodo(values);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setTodos((prev) => [result.todo, ...prev]);
    // Collapse back to the trigger; keep the last-used visibility for next time.
    reset({ title: "", due_date: "", property_id: "", visibility: values.visibility });
    setShowForm(false);
  }

  function closeForm() {
    reset({ title: "", due_date: "", property_id: "", visibility: "personal" });
    setShowForm(false);
  }

  function handleToggle(todo: PmTodo) {
    const next = !todo.is_done;
    // Optimistic: flip locally, roll back if the server rejects.
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id
          ? { ...t, is_done: next, completed_at: next ? new Date().toISOString() : null }
          : t
      )
    );
    startTransition(async () => {
      const result = await toggleTodo(todo.id, next);
      if (result && "error" in result) {
        toast.error(result.error);
        setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
      }
    });
  }

  function handleDelete(todo: PmTodo) {
    const snapshot = todos;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    startTransition(async () => {
      const result = await deleteTodo(todo.id);
      if (result && "error" in result) {
        toast.error(result.error);
        setTodos(snapshot);
      }
    });
  }

  function handleClearDone() {
    if (done.length === 0) return;
    const todosSnapshot = todos;
    const historySnapshot = history;
    const now = new Date().toISOString();
    const archived = done.map((t) => ({ ...t, archived_at: now }));
    // Optimistic: pull completed tasks off the board and into history.
    setTodos((prev) => prev.filter((t) => !t.is_done));
    setHistory((prev) => [...archived, ...prev]);
    startTransition(async () => {
      const result = await clearCompletedTodos();
      if (result && "error" in result) {
        toast.error(result.error);
        setTodos(todosSnapshot);
        setHistory(historySnapshot);
      } else {
        toast.success("Cleared completed tasks to history");
      }
    });
  }

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-brand-subtle">
            <ListTodo className="h-4 w-4 text-brand" strokeWidth={2} />
          </div>
          <h2 className="text-base font-semibold text-foreground">To-do list</h2>
          {open.length > 0 && (
            <span className="text-xs font-medium text-foreground-secondary bg-surface-inset px-2 py-0.5 rounded-full">
              {open.length} open
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {done.length > 0 && (
            <button
              type="button"
              onClick={handleClearDone}
              title="Move completed tasks to history now (they clear automatically each day)"
              className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors"
            >
              Clear done ({done.length})
            </button>
          )}
          {!showForm && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4" />
              Add task
            </Button>
          )}
        </div>
      </div>

      {/* Add form — collapsed behind the "Add task" button until opened */}
      {showForm && (
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-xl bg-surface-inset p-4 space-y-3 mb-5"
      >
        {/* Task */}
        <div>
          <label htmlFor="todo-title" className="block text-sm font-medium text-foreground mb-0.5">
            Task <span className="text-red-500">*</span>
          </label>
          <p className="text-[11px] text-foreground-muted mb-1.5">
            What needs doing — max 200 characters.
          </p>
          <input
            id="todo-title"
            {...register("title")}
            placeholder="e.g. Chase gas certificate for 12 Oak Rd"
            className={cn(
              "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50",
              errors.title ? "border-red-400" : "border-border"
            )}
          />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
        </div>

        {/* Due date + Property */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="todo-due" className="block text-sm font-medium text-foreground mb-0.5">
              Due date
            </label>
            <p className="text-[11px] text-foreground-muted mb-1.5">Optional — when it&apos;s due.</p>
            <input
              id="todo-due"
              type="date"
              {...register("due_date")}
              className={cn(
                "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50",
                errors.due_date ? "border-red-400" : "border-border"
              )}
            />
            {errors.due_date && (
              <p className="text-xs text-red-600 mt-1">{errors.due_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-0.5">Property</label>
            <p className="text-[11px] text-foreground-muted mb-1.5">Optional — link to a property.</p>
            <SearchableSelect
              value={propertyId}
              onChange={(val) => setValue("property_id", val, { shouldValidate: true })}
              options={[
                { value: "", label: "No property" },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
              placeholder="No property"
              error={!!errors.property_id}
            />
            {errors.property_id && (
              <p className="text-xs text-red-600 mt-1">{errors.property_id.message}</p>
            )}
          </div>
        </div>

        {/* Visibility + submit */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-0.5">Visibility</label>
            <p className="text-[11px] text-foreground-muted mb-1.5">
              Personal is only yours; Team is shared with everyone in your agency.
            </p>
            <div className="inline-flex rounded-lg border border-border bg-surface-card p-0.5">
              {(["personal", "team"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setValue("visibility", v)}
                  title={
                    v === "personal"
                      ? "Only you can see this task"
                      : "Everyone in your agency can see and complete this task"
                  }
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors",
                    visibility === v
                      ? "bg-brand text-brand-fg shadow-sm"
                      : "text-foreground-secondary hover:text-foreground"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isSubmitting}>
              Add task
            </Button>
          </div>
        </div>
      </form>
      )}

      {/* List */}
      {todos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-inset mb-3">
            <ListTodo className="h-5 w-5 text-foreground-muted" strokeWidth={1.6} />
          </div>
          <p className="text-sm text-foreground-secondary">
            No tasks yet — hit <span className="font-medium text-foreground">Add task</span> to create one.
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {open.map((t) => (
            <TodoRow key={t.id} todo={t} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
          {done.length > 0 && (
            <li className="pt-2 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                Completed
              </p>
            </li>
          )}
          {done.map((t) => (
            <TodoRow key={t.id} todo={t} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </ul>
      )}

      {/* Completed history (audit) — read-only, collapsed by default */}
      {history.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            aria-expanded={showHistory}
            title="Tasks that have been completed and cleared"
            className="flex items-center gap-2 text-[13px] font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            Completed history ({history.length})
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showHistory && "rotate-180")}
            />
          </button>

          {showHistory && (
            <ul className="mt-3 space-y-1">
              {history.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl">
                  <span className="shrink-0 h-5 w-5 rounded-md bg-surface-inset border border-border flex items-center justify-center text-foreground-muted">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground-muted line-through truncate">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-foreground-muted">
                      {t.completed_at && (
                        <span className="inline-flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Done {formatDoneDate(t.completed_at)}
                        </span>
                      )}
                      {t.property_name && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate max-w-[12rem]">{t.property_name}</span>
                        </span>
                      )}
                      {t.visibility === "team" && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {t.creator_name}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Row
// ──────────────────────────────────────────────────────────

function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: PmTodo;
  onToggle: (t: PmTodo) => void;
  onDelete: (t: PmTodo) => void;
}) {
  const due = formatDue(todo.due_date, todo.is_done);
  return (
    <li className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-inset transition-colors">
      <button
        type="button"
        onClick={() => onToggle(todo)}
        title={todo.is_done ? "Mark as not done" : "Mark as done"}
        aria-pressed={todo.is_done}
        className={cn(
          "shrink-0 h-5 w-5 rounded-md border flex items-center justify-center transition-colors",
          todo.is_done
            ? "bg-brand border-brand text-brand-fg"
            : "border-border-strong hover:border-brand text-transparent"
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate",
            todo.is_done ? "text-foreground-muted line-through" : "text-foreground"
          )}
        >
          {todo.title}
        </p>
        {(due || todo.property_name || todo.visibility === "team") && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {due && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium",
                  due.tone
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {due.label}
              </span>
            )}
            {todo.property_name && (
              <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                <Building2 className="h-3 w-3" />
                <span className="truncate max-w-[12rem]">{todo.property_name}</span>
              </span>
            )}
            {todo.visibility === "team" && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-foreground-muted"
                title={`Team task added by ${todo.creator_name}`}
              >
                <Users className="h-3 w-3" />
                {todo.creator_name}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDelete(todo)}
        title="Delete task"
        className="shrink-0 p-1.5 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 focus:opacity-100 transition-all"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

// ──────────────────────────────────────────────────────────
// Due-date presentation
// ──────────────────────────────────────────────────────────

function formatDue(
  iso: string | null,
  isDone: boolean
): { label: string; tone: string } | null {
  if (!iso) return null;
  const due = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  const label =
    diffDays === 0
      ? "Today"
      : diffDays === 1
      ? "Tomorrow"
      : diffDays === -1
      ? "Yesterday"
      : due.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  if (isDone) return { label, tone: "text-foreground-muted" };
  if (diffDays < 0) return { label: `${label} · overdue`, tone: "text-red-600" };
  if (diffDays === 0) return { label, tone: "text-amber-600" };
  return { label, tone: "text-foreground-muted" };
}

/** Short "when completed" label for the history/audit list. */
function formatDoneDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
