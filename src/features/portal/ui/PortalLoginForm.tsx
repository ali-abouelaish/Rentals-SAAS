"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

type LoginValues = z.infer<typeof loginSchema>;

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

interface Props {
  agencyName: string;
  companySlug: string | null;
  linkExpired: boolean;
}

export function PortalLoginForm({ agencyName, companySlug, linkExpired }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    try {
      const path = companySlug
        ? `/api/portal/login-link?companySlug=${encodeURIComponent(companySlug)}`
        : "/api/portal/login-link";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setServerError(body?.error ?? "Something went wrong — please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setServerError("Something went wrong — please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-border bg-surface-card p-6 shadow-sm sm:p-8">
        {submitted ? (
          <div className="text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-inset">
              <MailCheck className="h-6 w-6 text-foreground-secondary" />
            </span>
            <h1
              className="text-[1.5rem] leading-tight tracking-[-0.01em] text-foreground"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              Check your inbox
            </h1>
            <p className="mt-3 text-sm text-foreground-secondary">
              If that email matches a tenant on file with {agencyName}, we&apos;ve
              sent it a sign-in link. The link expires in 20 minutes — if it
              doesn&apos;t arrive, check your spam folder or try again.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground-muted">
              Sign in
            </p>
            <h1
              className="mt-1 text-[1.5rem] leading-tight tracking-[-0.01em] text-foreground"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              Your tenancy, in one place
            </h1>
            <p className="mt-2 text-sm text-foreground-secondary">
              Rent, maintenance, deposit protection and contact details — no
              password needed, we&apos;ll email you a sign-in link.
            </p>

            {linkExpired ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                That sign-in link has expired or already been replaced — request
                a fresh one below.
              </div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="portal-email"
                  className="block text-sm font-medium text-foreground"
                >
                  Email address
                </label>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  Use the email address your letting agent has on file for you.
                </p>
                <input
                  id="portal-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-xl border border-border bg-surface-ground px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-border-ring/40"
                  {...register("email")}
                />
                {errors.email ? (
                  <p className="mt-1.5 text-xs text-error" role="alert">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              {serverError ? (
                <p className="text-xs text-error" role="alert">
                  {serverError}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full"
                loading={isSubmitting}
              >
                {isSubmitting ? "Sending link…" : "Email me a sign-in link"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
