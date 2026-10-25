"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordResetForSignedOut } from "../actions/auth";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../domain/schemas";
import { DoorField, describedBy } from "./door/DoorField";
import { ArrowIcon } from "./door/icons";
import { useHydrated } from "./door/useHydrated";

/**
 * "Forgot password?": sends a reset link. The reply never says whether the address has an account.
 * `initialError` is what /auth/callback hands back when a link has expired or was already used.
 */
export function ForgotPasswordForm({ initialError }: { initialError: string | null }) {
  const hydrated = useHydrated();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // No defaultValues, so an address typed before hydration survives it (see LoginForm).
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });
  const { errors } = form.formState;

  const onValid = (values: ForgotPasswordValues) => {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordResetForSignedOut(values);
      if (result.ok) {
        setSentTo(values.email);
        return;
      }
      if (result.fields?.email) form.setError("email", { message: result.fields.email });
      setError(result.error);
    });
  };

  if (sentTo) {
    return (
      <>
        <div className="alert alert--ok" role="status">
          <p>
            If an account uses <strong>{sentTo}</strong>, a reset link is on its way. Open it in this browser to choose a
            new password.
          </p>
        </div>
        <div className="plate__actions">
          <a className="submit" href="/login">
            <span className="submit__label">Back to sign in</span>
            <ArrowIcon />
          </a>
          <button
            className="submit submit--quiet"
            type="button"
            onClick={() => {
              setSentTo(null);
              form.reset({ email: "" });
            }}
          >
            <span className="submit__label">Send to a different email</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {error ? (
        <div className="alert" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      <form className="form" method="post" noValidate onSubmit={form.handleSubmit(onValid)}>
        <DoorField id="fp-email" label="Work email" hint="We’ll email a reset link to this address." error={errors.email?.message}>
          <input
            className="input"
            id="fp-email"
            type="email"
            autoComplete="email"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="name@agency.co.uk"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy("fp-email", errors.email?.message)}
            {...form.register("email")}
          />
        </DoorField>
        <button className="submit" type="submit" disabled={!hydrated || isPending} aria-busy={isPending}>
          <span className="spin" aria-hidden="true" />
          <span className="submit__label">{isPending ? "Sending…" : "Send reset link"}</span>
          <ArrowIcon />
        </button>
      </form>
      <p className="plate__note">
        Remembered it? <a href="/login">Sign in</a>
      </p>
    </>
  );
}
