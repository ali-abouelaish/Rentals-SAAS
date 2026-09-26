"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditDiff, logPlatformAudit } from "@/lib/audit/platformAudit";
import { formatPence } from "@/lib/envelopes/packs";
import {
  COST_MODE_LABELS,
  EXPENSE_CATEGORIES,
  getExpenseCategory,
} from "@/lib/finance/platformExpenses";

const ADMIN_PATH = "/admin/finance";

type Result = { error: string } | { success: true; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Server-side validation, mirrored on the client by ExpenseDialog.
 *
 * The cross-field rules are the ones that matter: an amortised cost with no term
 * has no monthly slice and would silently contribute nothing to every month, and
 * a window that closes before it opens contributes nothing either. Both are also
 * CHECK constraints on the table — this layer exists so the operator gets a
 * sentence instead of a constraint violation.
 */
const expenseSchema = z
  .object({
    category: z.enum(
      EXPENSE_CATEGORIES.map((c) => c.key) as [string, ...string[]],
      { errorMap: () => ({ message: "Pick a category" }) }
    ),
    label: z
      .string()
      .trim()
      .min(2, "Give it a name of at least 2 characters")
      .max(120, "Keep the name under 120 characters"),
    vendor: z.string().trim().max(120, "Keep the vendor under 120 characters").optional(),
    amountPence: z
      .number({ invalid_type_error: "Enter an amount" })
      .int("Amount must be a whole number of pence")
      .positive("Amount must be more than zero")
      .max(100_000_000, "That is over £1,000,000 — check the amount"),
    costMode: z.enum(["recurring", "one_off", "amortised"]),
    startsOn: z.string().regex(ISO_DATE, "Use a valid date"),
    endsOn: z.string().regex(ISO_DATE, "Use a valid date").nullable().optional(),
    amortiseMonths: z
      .number()
      .int()
      .positive("Spread must be at least 1 month")
      .max(120, "Spread cannot exceed 120 months")
      .nullable()
      .optional(),
    notes: z.string().trim().max(1000, "Keep notes under 1000 characters").optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.costMode !== "amortised" || !!v.amortiseMonths, {
    message: "Tell us how many months to spread this over",
    path: ["amortiseMonths"],
  })
  .refine((v) => !v.endsOn || v.endsOn >= v.startsOn, {
    message: "The end date cannot be before the start date",
    path: ["endsOn"],
  })
  .refine((v) => v.costMode === "recurring" || !v.endsOn, {
    message: "Only a recurring cost has an end date",
    path: ["endsOn"],
  });

export type ExpenseInput = z.input<typeof expenseSchema>;

/** Null out the fields that do not apply to the chosen mode. */
function normalise(input: z.output<typeof expenseSchema>) {
  return {
    category: input.category,
    label: input.label,
    vendor: input.vendor?.trim() || null,
    amount_pence: input.amountPence,
    cost_mode: input.costMode,
    starts_on: input.startsOn,
    // Carrying a stale end date on a one-off, or a term on a recurring cost,
    // would leave the row describing a rule it is not following.
    ends_on: input.costMode === "recurring" ? input.endsOn ?? null : null,
    amortise_months: input.costMode === "amortised" ? input.amortiseMonths ?? null : null,
    notes: input.notes?.trim() || null,
    is_active: input.isActive ?? true,
  };
}

function describe(values: ReturnType<typeof normalise>): string {
  const category = getExpenseCategory(values.category)?.label ?? values.category;
  const mode = COST_MODE_LABELS[values.cost_mode as keyof typeof COST_MODE_LABELS];
  const term =
    values.cost_mode === "amortised" && values.amortise_months
      ? ` over ${values.amortise_months} months`
      : "";
  return `${values.label} — ${formatPence(values.amount_pence)} ${mode.toLowerCase()}${term} (${category})`;
}

export async function createExpenseAction(input: ExpenseInput): Promise<Result> {
  const actor = await requireSuperAdmin();

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const values = normalise(parsed.data);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("platform_expenses")
    .insert({ ...values, created_by: actor.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not save the expense." };
  }

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "platform_expense_created",
    summary: `Expense added — ${describe(values)}`,
    entityType: "platform_expense",
    entityId: data.id as string,
    after: values,
    metadata: { amount_pence: values.amount_pence, cost_mode: values.cost_mode },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true, message: "Expense added." };
}

export async function updateExpenseAction(
  input: ExpenseInput & { id: string }
): Promise<Result> {
  const actor = await requireSuperAdmin();

  if (!z.string().uuid().safeParse(input.id).success) {
    return { error: "Invalid expense." };
  }

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const values = normalise(parsed.data);
  const admin = createSupabaseAdminClient();

  // Read first so the audit row records what changed, not just the new state.
  // Editing an expense silently rewrites past months' profit, which is exactly
  // the kind of change worth being able to trace later.
  const { data: prior } = await admin
    .from("platform_expenses")
    .select(
      "category, label, vendor, amount_pence, cost_mode, starts_on, ends_on, amortise_months, notes, is_active"
    )
    .eq("id", input.id)
    .maybeSingle();

  const { error } = await admin
    .from("platform_expenses")
    .update(values)
    .eq("id", input.id);

  if (error) return { error: error.message };

  const diff = auditDiff(prior ?? null, values);

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "platform_expense_updated",
    summary: `Expense updated — ${describe(values)}`,
    entityType: "platform_expense",
    entityId: input.id,
    before: diff.before,
    after: diff.after,
  });

  revalidatePath(ADMIN_PATH);
  return { success: true, message: "Expense updated." };
}

/**
 * Delete an expense outright.
 *
 * Deliberately a hard delete rather than a soft one: `is_active` already exists
 * for "stop counting this", and keeping a second kind of dead row would make the
 * list harder to read for no gain. The audit row holds the full record, so a
 * deletion made in error is reconstructable.
 */
export async function deleteExpenseAction(input: { id: string }): Promise<Result> {
  const actor = await requireSuperAdmin();

  if (!z.string().uuid().safeParse(input.id).success) {
    return { error: "Invalid expense." };
  }

  const admin = createSupabaseAdminClient();

  const { data: prior } = await admin
    .from("platform_expenses")
    .select(
      "category, label, vendor, amount_pence, cost_mode, starts_on, ends_on, amortise_months, notes, is_active"
    )
    .eq("id", input.id)
    .maybeSingle();

  const { error } = await admin.from("platform_expenses").delete().eq("id", input.id);
  if (error) return { error: error.message };

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "platform_expense_deleted",
    summary: `Expense deleted — ${prior?.label ?? "unknown"}${
      prior ? ` (${formatPence(prior.amount_pence as number)})` : ""
    }`,
    entityType: "platform_expense",
    entityId: input.id,
    // The whole row, so a deletion made in error can be put back.
    before: (prior as Record<string, unknown>) ?? null,
    severity: "warning",
  });

  revalidatePath(ADMIN_PATH);
  return { success: true, message: "Expense deleted." };
}

/** Stop or resume counting an expense without deleting its history. */
export async function setExpenseActiveAction(input: {
  id: string;
  isActive: boolean;
}): Promise<Result> {
  const actor = await requireSuperAdmin();

  if (!z.string().uuid().safeParse(input.id).success) {
    return { error: "Invalid expense." };
  }

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("platform_expenses")
    .update({ is_active: input.isActive })
    .eq("id", input.id)
    .select("label")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not update the expense." };

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: input.isActive ? "platform_expense_resumed" : "platform_expense_paused",
    summary: `Expense ${input.isActive ? "resumed" : "paused"} — ${data.label}`,
    entityType: "platform_expense",
    entityId: input.id,
    before: { is_active: !input.isActive },
    after: { is_active: input.isActive },
  });

  revalidatePath(ADMIN_PATH);
  return {
    success: true,
    message: input.isActive ? "Expense resumed." : "Expense paused.",
  };
}
