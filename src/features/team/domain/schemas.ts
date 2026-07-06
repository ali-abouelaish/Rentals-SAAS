import { z } from "zod";

/**
 * Team members are the staff accounts that belong to a tenant (agency).
 *
 * For now the only assignable role is `admin`: every property-management nav
 * item is gated to ADMIN_ROLES, so a non-admin user would see an effectively
 * empty app. The `role` field is kept as an enum so it can be widened later
 * (e.g. once a PM-specific limited role exists) without changing callers.
 */
export const teamInviteSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Max 120 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  role: z.enum(["admin"]).default("admin")
});

export type TeamInviteValues = z.infer<typeof teamInviteSchema>;
