"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmail } from "../actions/auth";
import { loginSchema, type LoginValues } from "../domain/schemas";
import { DoorField, describedBy } from "./door/DoorField";
import { PasswordInput } from "./door/PasswordInput";
import { ArrowIcon, TickIcon } from "./door/icons";
import { Welcome } from "./door/Welcome";
import { rattle, walkIn } from "./door/motion";
import { useHydrated } from "./door/useHydrated";

/**
 * Sign-in, on the enamel plate. A wrong password rattles the plate; the right one swings the door
 * open, walks down the hallway and then goes to the workspace (usually the agency's own subdomain).
 *
 * The ids login-email / login-password and the submit button are what e2e/lib/harness.mjs fills in.
 */
export function LoginForm({ next, disabledNotice }: { next: string | null; disabledNotice: boolean }) {
  const hydrated = useHydrated();
  const [isPending, startTransition] = useTransition();
  const [opening, setOpening] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [status, setStatus] = useState("");
  const [alert, setAlert] = useState<{ text: string; offerReset?: boolean } | null>(
    disabledNotice ? { text: "Your account has been disabled. Contact your admin." } : null
  );
  const formRef = useRef<HTMLFormElement>(null);

  // No defaultValues: when React takes over, register() writes them into the inputs, wiping anything
  // typed or autofilled before then (and what the e2e harness fills in on page load). Unset, each
  // field starts from what's in it; the checkbox's default is its defaultChecked.
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const { errors } = form.formState;
  const busy = isPending || opening;

  const onValid = (values: LoginValues) => {
    setAlert(null);
    startTransition(async () => {
      const result = await signInWithEmail({ ...values, next });
      if (result.ok) {
        setOpening(true);
        setStatus("Welcome back. Opening your workspace…");
        void walkIn(formRef.current).then(() => window.location.assign(result.redirectTo));
        return;
      }
      for (const [field, message] of Object.entries(result.fields ?? {})) {
        if (message) form.setError(field as keyof LoginValues, { message });
      }
      setAlert({ text: result.error, offerReset: result.kind === "credentials" });
      rattle(formRef.current?.closest<HTMLElement>(".plate") ?? null);
      form.setValue("password", "");
      form.setFocus("password");
    });
  };

  const onInvalid = (invalid: FieldErrors<LoginValues>) => {
    const count = Object.keys(invalid).length;
    setStatus(count === 1 ? "One answer needs attention." : `${count} answers need attention.`);
  };

  return (
    <>
      {alert ? (
        <div className="alert" role="alert">
          <p>
            {alert.text}
            {alert.offerReset ? (
              <>
                {" "}
                Try again, or <a href="/forgot-password">reset your password</a>.
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {/* method="post": should it ever be sent before React takes over, nothing lands in the URL */}
      <form ref={formRef} className="form" method="post" noValidate onSubmit={form.handleSubmit(onValid, onInvalid)}>
        <DoorField id="login-email" label="Work email" hint="The address your Harbor account uses." error={errors.email?.message}>
          <input
            className="input"
            id="login-email"
            type="email"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="name@agency.co.uk"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy("login-email", errors.email?.message)}
            {...form.register("email")}
          />
        </DoorField>

        <DoorField
          id="login-password"
          label="Password"
          hint={capsLock ? "Caps Lock is on." : "Passwords are case-sensitive."}
          hintLive
          error={errors.password?.message}
          aside={
            <a className="field__link" href="/forgot-password">
              Forgot password?
            </a>
          }
        >
          <PasswordInput
            id="login-password"
            registration={form.register("password")}
            autoComplete="current-password"
            error={errors.password?.message}
            onCapsLockChange={setCapsLock}
          />
        </DoorField>

        <div className="check-group">
          <label className="check">
            <input type="checkbox" defaultChecked aria-describedby="login-stay-hint" {...form.register("stay_signed_in")} />
            <span className="check__box">
              <TickIcon />
            </span>
            <span>Keep me signed in on this device</span>
          </label>
          <p className="field__hint" id="login-stay-hint">
            On a shared computer, untick this: you’ll be signed out when the browser closes.
          </p>
        </div>

        <button className="submit" type="submit" disabled={!hydrated || busy} aria-busy={busy}>
          <span className="spin" aria-hidden="true" />
          <span className="submit__label">{busy ? "Signing in…" : "Sign in"}</span>
          <ArrowIcon />
        </button>
      </form>
      <p className="sr-only" role="status">
        {status}
      </p>

      <Welcome open={opening} />
    </>
  );
}
