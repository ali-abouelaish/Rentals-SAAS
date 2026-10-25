import { z } from "zod";

/**
 * Sign-in screens (the "front door"). Each schema is used twice: by the form (React Hook Form's
 * zodResolver) and again by the server action, which never trusts the client.
 * Messages are the designer's own wording.
 */

// pipe(): an empty field says "Enter your work email" only, not that and "not an email address" too
export const emailField = z
  .string()
  .trim()
  .min(1, "Enter your work email")
  .pipe(
    z
      .string()
      .max(254, "That email address is too long")
      .email("Enter an email address like name@agency.co.uk")
  );

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password").max(1000, "That password is too long"),
  stay_signed_in: z.boolean(),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/** Choosing a password: after a reset link, or when accepting an invite. */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Use 72 characters or fewer"),
    confirm: z.string().min(1, "Type the password again"),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "The two passwords don't match",
  });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
