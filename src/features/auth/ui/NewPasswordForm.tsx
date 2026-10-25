"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { newPasswordSchema, type NewPasswordValues } from "../domain/schemas";
import { DoorField, describedBy } from "./door/DoorField";
import { PasswordInput } from "./door/PasswordInput";
import { ArrowIcon } from "./door/icons";
import { Welcome } from "./door/Welcome";
import { walkIn } from "./door/motion";
import { useHydrated } from "./door/useHydrated";

function strength(value: string): { score: 0 | 1 | 2 | 3 | 4; hint: string } {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  const hints = [
    "At least 8 characters. Longer, with numbers and symbols, is stronger.",
    "Long enough. Mix in capitals, numbers or symbols to make it stronger.",
    "Getting stronger.",
    "Strong.",
    "Excellent.",
  ];
  return { score: score as 0 | 1 | 2 | 3 | 4, hint: hints[score] };
}

/**
 * Choosing a password on the plate: after a reset link ("reset", which needs the recovery session
 * the link set up) or when accepting an invite ("invite", where the door then swings open onto the
 * dashboard). Supabase's updateUser call runs in the browser, on the session the email link opened.
 */
export function NewPasswordForm({ mode }: { mode: "reset" | "invite" }) {
  const hydrated = useHydrated();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isPending, startTransition] = useTransition();
  const [ready, setReady] = useState(mode === "invite");
  const [checking, setChecking] = useState(mode === "reset");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (mode !== "reset") return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setReady(Boolean(data.session));
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, [mode, supabase]);

  // No defaultValues, so a password typed before hydration survives it (see LoginForm).
  const form = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) });
  const { errors } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });
  const meter = strength(password ?? "");

  const onValid = (values: NewPasswordValues) => {
    setError(null);
    startTransition(async () => {
      const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setDone(true);
      if (mode === "invite") {
        void walkIn(formRef.current).then(() => window.location.assign("/dashboard"));
      }
    });
  };

  if (done && mode === "reset") {
    return (
      <>
        <div className="alert alert--ok" role="status">
          <p>Your password has been changed. Use it next time you sign in.</p>
        </div>
        <div className="plate__actions">
          {/* /login forwards a signed-in visitor straight to their workspace */}
          <a className="submit" href="/login">
            <span className="submit__label">Open your workspace</span>
            <ArrowIcon />
          </a>
        </div>
      </>
    );
  }

  const busy = isPending || (done && mode === "invite");
  const locked = !ready || checking || busy;

  return (
    <>
      {!checking && !ready ? (
        <div className="alert" role="alert">
          <p>
            Open this page from the link in your reset email. If the link has expired,{" "}
            <a href="/forgot-password">request a new one</a>.
          </p>
        </div>
      ) : null}
      {error ? (
        <div className="alert" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <form ref={formRef} className="form" method="post" noValidate onSubmit={form.handleSubmit(onValid)}>
        <DoorField
          id="np-password"
          label={mode === "invite" ? "Choose a password" : "New password"}
          hint={capsLock ? "Caps Lock is on." : meter.hint}
          hintLive
          error={errors.password?.message}
        >
          <PasswordInput
            id="np-password"
            registration={form.register("password")}
            autoComplete="new-password"
            error={errors.password?.message}
            disabled={locked}
            onCapsLockChange={setCapsLock}
          />
          <span className={`strength s${meter.score}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </DoorField>

        <DoorField id="np-confirm" label="Type it again" hint="So we know it’s the one you meant." error={errors.confirm?.message}>
          <input
            className="input"
            id="np-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.confirm ? true : undefined}
            aria-describedby={describedBy("np-confirm", errors.confirm?.message)}
            disabled={locked}
            {...form.register("confirm")}
          />
        </DoorField>

        <button className="submit" type="submit" disabled={!hydrated || locked} aria-busy={busy}>
          <span className="spin" aria-hidden="true" />
          <span className="submit__label">
            {busy ? "Saving…" : mode === "invite" ? "Activate my account" : "Save new password"}
          </span>
          <ArrowIcon />
        </button>
      </form>
      <p className="sr-only" role="status">
        {done && mode === "invite" ? "Account activated. Opening your workspace…" : ""}
      </p>
      {mode === "invite" ? (
        <>
          <p className="plate__note">
            Already set one? <a href="/login">Sign in</a>
          </p>
          <Welcome open={done} text="Account ready. Opening your workspace…" />
        </>
      ) : (
        <p className="plate__note">
          Didn’t get an email? <a href="/forgot-password">Request another link</a>
        </p>
      )}
    </>
  );
}
