"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { ThankYouDialog } from "@/components/shared/ThankYouDialog";
import { cardEnquirySchema, type CardEnquiryValues } from "../domain/schemas";
import { submitCardEnquiry } from "../actions/cardEnquiry";

const FIELDS: Array<{
  name: keyof CardEnquiryValues;
  label: string;
  hint: string;
  placeholder: string;
  type?: "text" | "tel";
}> = [
  {
    name: "name",
    label: "Full Name",
    hint: "Required. How the agent should address you.",
    placeholder: "Your name",
  },
  {
    name: "phone",
    label: "Phone Number",
    hint: "Required. Include the country code if you're outside the UK.",
    placeholder: "+44 7700 900000",
    type: "tel",
  },
  {
    name: "pref_area",
    label: "Preferred Area",
    hint: "Optional. An area, postcode or station.",
    placeholder: "e.g. City Centre, Zone 2…",
  },
  {
    name: "budget",
    label: "Budget",
    hint: "Optional. Roughly what you'd like to spend each month.",
    placeholder: "e.g. £1,200 / month",
  },
  {
    name: "occupation",
    label: "Occupation",
    hint: "Optional. Helps the agent suggest the right places.",
    placeholder: "e.g. Software Engineer",
  },
];

export function CardEnquiryForm({
  agentId,
  agentName,
  agentAvatarUrl,
  brandName,
  brandLogoUrl,
}: {
  agentId: string;
  agentName: string;
  agentAvatarUrl?: string | null;
  brandName?: string | null;
  brandLogoUrl?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CardEnquiryValues>({
    resolver: zodResolver(cardEnquirySchema),
    defaultValues: { name: "", phone: "", pref_area: "", budget: "", occupation: "" },
  });
  const { errors } = form.formState;

  const onSubmit = (values: CardEnquiryValues) => {
    setFormError(null);
    startTransition(async () => {
      const result = await submitCardEnquiry(agentId, values);
      if (result.ok) {
        // Pop the confirmation straight away. The inline panel below stays
        // too, so dismissing the popup doesn't drop the enquirer back onto a
        // live form they might submit a second time.
        setSent(true);
        setShowThanks(true);
        return;
      }
      setFormError(result.error);
      for (const [field, message] of Object.entries(result.fields ?? {})) {
        if (message) form.setError(field as keyof CardEnquiryValues, { message });
      }
    });
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.25)",
    backdropFilter: "blur(6px)",
    color: "white",
    borderRadius: "14px",
    padding: "12px 16px",
    fontSize: "15px",
    width: "100%",
    outline: "none",
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center text-center px-8 py-14 gap-5"
      >
        <ThankYouDialog
          open={showThanks}
          onOpenChange={setShowThanks}
          message="Your enquiry has been sent."
          footnote={`${agentName} will be in touch with you shortly.`}
          actionLabel="Done"
        />
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">Thank you</h2>
          <p className="text-white/75 text-sm leading-relaxed">
            {agentName} will be in touch with you shortly.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 px-9 pt-8 pb-10">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-2 gap-2">
        {brandLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brandLogoUrl} alt={brandName ?? ""} className="h-12 w-auto object-contain" />
        )}
        {agentAvatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agentAvatarUrl}
            alt={agentName}
            className="h-14 w-14 rounded-full object-cover"
            style={{ border: "2px solid rgba(255,255,255,0.4)" }}
          />
        )}
        <div>
          <h1 className="text-lg font-bold text-white uppercase tracking-widest">
            {brandName ?? "Enquiry"}
          </h1>
          <p className="text-white/60 text-xs mt-0.5">with {agentName}</p>
        </div>
      </div>

      {/* Error */}
      {formError && (
        <p role="alert" className="text-sm text-red-300 text-center -mt-1">
          {formError}
        </p>
      )}

      {/* Fields */}
      {FIELDS.map((field) => {
        const id = `card-enquiry-${field.name}`;
        const error = errors[field.name]?.message;
        return (
          <div key={field.name} className="space-y-1">
            <label htmlFor={id} className="block text-xs font-medium text-white/70 uppercase tracking-wider">
              {field.label}
            </label>
            <p id={`${id}-hint`} className="text-[11px] text-white/55">
              {field.hint}
            </p>
            <input
              id={id}
              type={field.type ?? "text"}
              placeholder={field.placeholder}
              autoComplete={field.name === "name" ? "name" : field.name === "phone" ? "tel" : "off"}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
              style={inputStyle}
              className="placeholder:text-white/35"
              {...form.register(field.name)}
            />
            {error && (
              <p id={`${id}-error`} className="text-xs text-red-300">
                {error}
              </p>
            )}
          </div>
        );
      })}

      <div className="pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-2xl py-4 text-base font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.35)",
            backdropFilter: "blur(8px)",
          }}
        >
          {isPending ? "Submitting…" : "Send Enquiry"}
        </button>
      </div>
    </form>
  );
}
