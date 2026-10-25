"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DoorField, DoorFieldset, describedBy } from "@/features/auth/ui/door/DoorField";
import { ArrowIcon, DoneMark, TickIcon } from "@/features/auth/ui/door/icons";
import { postCard } from "@/features/auth/ui/door/motion";
import { useHydrated } from "@/features/auth/ui/door/useHydrated";
import { submitDemoRequest } from "../actions/submit";
import {
  demoRequestSchema,
  GOAL_MAX,
  HONEYPOT_FIELD,
  PORTFOLIO_SIZES,
  type DemoRequestValues,
  type PlanInterest,
} from "../domain/schemas";

/**
 * The demo request, as a postcard on the door: filled in, then posted through the letterbox. A
 * quote request (from the Enterprise pricing card) is the same card with its own words.
 */
export function DemoRequestForm({ plan, siteHref }: { plan: PlanInterest | null; siteHref: string }) {
  const quote = plan === "enterprise";
  const hydrated = useHydrated();
  const [isPending, startTransition] = useTransition();
  const [posting, setPosting] = useState(false);
  const [sent, setSent] = useState<{ firstName: string; email: string } | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const cardRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  // Only plan, which has no input. The fields start from what's in them, so answers typed before
  // hydration survive it (see LoginForm in features/auth).
  const form = useForm<DemoRequestValues>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: { plan },
  });
  const { errors } = form.formState;
  const busy = isPending || posting;

  useEffect(() => {
    if (!sent) return;
    doneRef.current?.scrollIntoView({ block: "center" });
    doneRef.current?.focus({ preventScroll: true });
  }, [sent]);

  const onValid = (values: DemoRequestValues) => {
    setAlert(null);
    startTransition(async () => {
      const result = await submitDemoRequest({
        ...values,
        plan,
        [HONEYPOT_FIELD]: honeypotRef.current?.value ?? "",
      });
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fields ?? {})) {
          if (message) form.setError(field as keyof DemoRequestValues, { message });
        }
        setAlert(result.error);
        return;
      }
      setPosting(true);
      const card = cardRef.current;
      const box = document.querySelector<HTMLElement>(".harbor-door .letterbox");
      if (card && box) await postCard(card, box);
      setSent({ firstName: values.first_name, email: values.email });
    });
  };

  const onInvalid = (invalid: FieldErrors<DemoRequestValues>) => {
    const count = Object.keys(invalid).length;
    setStatus(count === 1 ? "One answer needs attention." : `${count} answers need attention.`);
  };

  const field = (name: keyof DemoRequestValues) => ({
    "aria-invalid": errors[name] ? true : undefined,
    ...form.register(name),
  });

  return (
    <>
      <main className="card rise" style={{ "--d": 1 } as React.CSSProperties} id="main" ref={cardRef} hidden={Boolean(sent)}>
        <div className="stamp" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/brand/harbor-emblem-teal.svg" alt="" />
        </div>
        <div className="card__back" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/brand/og-image.jpg" alt="" width={1200} height={630} />
        </div>

        {/* method="post": should it ever be sent before React takes over, nothing lands in the URL */}
        <form className="card__grid" method="post" noValidate onSubmit={form.handleSubmit(onValid, onInvalid)}>
          <div className="card__head">
            <p className="eyebrow">{quote ? "Request a quote" : "Request a demo"}</p>
            <h1 className="card__title">
              <span className="t1">Bring your portfolio.</span> <span className="t2">Leave your spreadsheets.</span>
            </h1>
            <p className="lede">
              {quote
                ? "Fill in the card and post it. A person replies within 48 hours with a quote for your portfolio."
                : "Fill in the card and post it. A person replies within 48 hours to book your walkthrough."}
            </p>
          </div>
          <div className="card__rule" aria-hidden="true" />

          <div className="card__fields">
            <div className="row2">
              <DoorField id="su-first" label="First name" hint="Letters only, up to 60." error={errors.first_name?.message}>
                <input
                  className="input"
                  id="su-first"
                  type="text"
                  autoComplete="given-name"
                  aria-describedby={describedBy("su-first", errors.first_name?.message)}
                  {...field("first_name")}
                />
              </DoorField>
              <DoorField id="su-last" label="Last name" hint="Letters only, up to 60." error={errors.last_name?.message}>
                <input
                  className="input"
                  id="su-last"
                  type="text"
                  autoComplete="family-name"
                  aria-describedby={describedBy("su-last", errors.last_name?.message)}
                  {...field("last_name")}
                />
              </DoorField>
            </div>
            <DoorField id="su-email" label="Work email" hint="We’ll reply here, within 48 hours." error={errors.email?.message}>
              <input
                className="input"
                id="su-email"
                type="email"
                autoComplete="email"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="name@agency.co.uk"
                aria-describedby={describedBy("su-email", errors.email?.message)}
                {...field("email")}
              />
            </DoorField>
            <DoorField id="su-company" label="Company" hint="Your agency or operating company." error={errors.company?.message}>
              <input
                className="input"
                id="su-company"
                type="text"
                autoComplete="organization"
                aria-describedby={describedBy("su-company", errors.company?.message)}
                {...field("company")}
              />
            </DoorField>
            <DoorFieldset
              id="su-portfolio"
              legend="Portfolio size, in rooms"
              hint="Count rooms, not properties."
              error={errors.portfolio_size?.message}
            >
              <div className="chips" aria-invalid={errors.portfolio_size ? true : undefined}>
                {PORTFOLIO_SIZES.map((size) => (
                  <label className="chip" key={size.value}>
                    <input type="radio" value={size.value} {...form.register("portfolio_size")} />
                    <span>{size.chip}</span>
                  </label>
                ))}
              </div>
            </DoorFieldset>
          </div>

          {/* "note": the message side of the postcard, ruled, filling the space under the heading */}
          <DoorField
            id="su-goal"
            className="note"
            label="What are you hoping to solve?"
            optional
            hint={`Up to ${GOAL_MAX.toLocaleString("en-GB")} characters.`}
            error={errors.goal?.message}
          >
            <textarea
              className="input"
              id="su-goal"
              rows={4}
              maxLength={GOAL_MAX}
              placeholder="For example: margin leaking across a 60-room HMO portfolio."
              aria-describedby={describedBy("su-goal", errors.goal?.message)}
              {...field("goal")}
            />
          </DoorField>

          <div className="card__send">
            {alert ? (
              <div className="alert" role="alert">
                <p>{alert}</p>
              </div>
            ) : null}
            <div className="check-group">
              <label className="check">
                <input
                  id="su-terms"
                  type="checkbox"
                  aria-describedby={describedBy("su-terms", errors.terms?.message)}
                  {...field("terms")}
                />
                <span className="check__box">
                  <TickIcon />
                </span>
                <span>
                  I agree to Harbor’s <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
                </span>
              </label>
              <p className="field__hint" id="su-terms-hint">
                Needed so we can reply to you.
              </p>
              {errors.terms?.message ? (
                <p className="field__error" id="su-terms-error">
                  {errors.terms.message}
                </p>
              ) : null}
            </div>
            {/* Not for people: off-screen and out of the tab order. A bot that fills it in is ignored.
                Its name and label must not look like anything autofill knows (website, company, url…):
                Chrome ignores autocomplete="off", and an autofilled value silently drops a real request. */}
            <div className="hp" aria-hidden="true">
              <label htmlFor="su-leave-blank">Leave this empty</label>
              <input
                id="su-leave-blank"
                name={HONEYPOT_FIELD}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                data-1p-ignore=""
                data-lpignore="true"
                data-bwignore=""
                data-form-type="other"
                ref={honeypotRef}
              />
            </div>
            <button className="submit" type="submit" disabled={!hydrated || busy} aria-busy={busy}>
              <span className="spin" aria-hidden="true" />
              <span className="submit__label">{busy ? "Posting…" : quote ? "Request a quote" : "Request a demo"}</span>
              <ArrowIcon />
            </button>
          </div>
        </form>
        <p className="sr-only" role="status">
          {status}
        </p>
      </main>

      {sent ? (
        <section className="plate done" id="done" tabIndex={-1} aria-labelledby="doneTitle" ref={doneRef}>
          <span className="screw screw--tl" aria-hidden="true" />
          <span className="screw screw--tr" aria-hidden="true" />
          <span className="screw screw--bl" aria-hidden="true" />
          <span className="screw screw--br" aria-hidden="true" />
          <DoneMark />
          <h2 id="doneTitle">{quote ? "Quote request received." : "Request received."}</h2>
          <p>
            Thanks, <strong>{sent.firstName}</strong>. Our team will reply to <strong>{sent.email}</strong> within 48
            hours {quote ? "with a quote for your portfolio." : "to book your walkthrough."}
          </p>
          <a className="submit" href={siteHref}>
            Back to the website
            <ArrowIcon />
          </a>
        </section>
      ) : null}
    </>
  );
}
