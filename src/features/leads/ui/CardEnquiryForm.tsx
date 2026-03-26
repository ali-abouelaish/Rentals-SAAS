"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { submitCardEnquiry } from "../actions/cardEnquiry";

type State = { ok?: boolean; error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl py-4 text-base font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
      style={{
        background: "rgba(255,255,255,0.18)",
        border: "1px solid rgba(255,255,255,0.35)",
        backdropFilter: "blur(8px)",
      }}
    >
      {pending ? "Submitting…" : "Send Enquiry"}
    </button>
  );
}

export function CardEnquiryForm({
  agentId,
  tenantId,
  agentName,
  agentAvatarUrl,
  brandName,
  brandLogoUrl,
}: {
  agentId: string;
  tenantId: string;
  agentName: string;
  agentAvatarUrl?: string | null;
  brandName?: string | null;
  brandLogoUrl?: string | null;
}) {
  const [state, formAction] = useFormState(submitCardEnquiry, {});

  useEffect(() => {
    if (state?.error) {
      // inline error display — no toast needed on public page
    }
  }, [state?.error]);

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

  if (state?.ok) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center text-center px-8 py-14 gap-5"
      >
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
    <form action={formAction} className="flex flex-col gap-4 px-9 pt-8 pb-10">
      <input type="hidden" name="agent_id"  value={agentId} />
      <input type="hidden" name="tenant_id" value={tenantId} />

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
      {state?.error && (
        <p className="text-sm text-red-300 text-center -mt-1">{state.error}</p>
      )}

      {/* Fields */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-white/70 uppercase tracking-wider">Full Name</label>
        <input name="name" required placeholder="Your name" style={inputStyle}
          className="placeholder:text-white/35" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-white/70 uppercase tracking-wider">Phone Number</label>
        <input name="phone" type="tel" required placeholder="+44 7700 900000" style={inputStyle}
          className="placeholder:text-white/35" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-white/70 uppercase tracking-wider">Preferred Area</label>
        <input name="pref_area" placeholder="e.g. City Centre, Zone 2…" style={inputStyle}
          className="placeholder:text-white/35" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-white/70 uppercase tracking-wider">Budget</label>
        <input name="budget" placeholder="e.g. £1,200 / month" style={inputStyle}
          className="placeholder:text-white/35" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-white/70 uppercase tracking-wider">Occupation</label>
        <input name="occupation" placeholder="e.g. Software Engineer" style={inputStyle}
          className="placeholder:text-white/35" />
      </div>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
