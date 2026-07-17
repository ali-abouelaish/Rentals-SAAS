import { z } from "zod";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export type TodoVisibility = "personal" | "team";

export interface PmTodo {
  id: string;
  title: string;
  due_date: string | null; // ISO date (YYYY-MM-DD)
  property_id: string | null;
  property_name: string | null;
  visibility: TodoVisibility;
  is_done: boolean;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  created_by: string | null;
  creator_name: string;
}

// ──────────────────────────────────────────────────────────
// Validation (shared client + server)
// ──────────────────────────────────────────────────────────

export const TodoInputSchema = z.object({
  title: z.string().trim().min(1, "Enter a task").max(200, "Max 200 characters"),
  // Native <input type="date"> yields "" when empty; coerce that to undefined.
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  property_id: z
    .string()
    .uuid("Invalid property")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  visibility: z.enum(["personal", "team"]).default("personal"),
});

export type TodoInput = z.infer<typeof TodoInputSchema>;
