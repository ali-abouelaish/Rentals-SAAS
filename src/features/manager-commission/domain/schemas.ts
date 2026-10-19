import { z } from "zod";

const isoDate = z
  .string({ required_error: "Choose a date" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

/** The manager settings form. The manager's id is passed to the action
 *  separately — it has no input, and a schema key with no registered input
 *  makes React Hook Form fail silently. */
export const managerPlanSchema = z.object({
  commission_percent: z.coerce
    .number({ invalid_type_error: "Enter a percentage" })
    .gt(0, "Must be more than 0")
    .max(100, "Can't be more than 100")
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Use at most 2 decimal places"),
  applies_to: z.enum(["rentals", "bonuses", "both"], {
    errorMap: () => ({ message: "Choose what the percentage applies to" }),
  }),
  agent_ids: z
    .array(z.string().uuid())
    .min(1, "Pick at least one agent for the pool"),
  /** Own rate per agent id, as typed. Blank = use the manager's percentage.
   *  Only agents in agent_ids are saved; the form clears an agent's entry
   *  when they're unticked so a hidden value can never block submit. */
  agent_percents: z.record(
    z.string(),
    z
      .string()
      .trim()
      .refine(
        (v) => v === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) <= 100),
        "Between 0.01 and 100, up to 2 decimals — or leave blank"
      )
  ),
  effective_from: isoDate,
});

export type ManagerPlanValues = z.infer<typeof managerPlanSchema>;

export const endManagerPlanSchema = z.object({
  end_date: isoDate,
});

export type EndManagerPlanValues = z.infer<typeof endManagerPlanSchema>;

export const managerLinePaidSchema = z.object({
  manager_id: z.string().uuid(),
  source_type: z.enum(["rental", "bonus"]),
  source_id: z.string().uuid(),
  paid: z.boolean(),
});

export const managerIdSchema = z.string().uuid("Invalid manager");
