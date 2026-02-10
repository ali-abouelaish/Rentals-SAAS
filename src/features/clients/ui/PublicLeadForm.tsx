"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createPublicLead } from "@/features/clients/actions/publicLead";

type PublicLeadState = { ok?: boolean; error?: string };

const initialState: PublicLeadState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Submitting..." : "Submit"}
    </Button>
  );
}

export function PublicLeadForm({
  agentId,
  tenantId,
  agentName
}: {
  agentId: string;
  tenantId: string;
  agentName: string;
}) {
  const [state, formAction] = useFormState(createPublicLead, initialState);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Submitted successfully.");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.ok, state?.error]);

  return (
    <form
      action={formAction}
      className="w-full max-w-lg space-y-4 rounded-2xl border border-border-muted bg-surface-card p-8 shadow-card"
    >
      <div>
        <h1 className="font-heading text-2xl font-semibold text-navy">
          Client Lead Form
        </h1>
        <p className="text-sm text-foreground-secondary">Assigned to {agentName}</p>
      </div>
      <input type="hidden" name="agent_id" value={agentId} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <Input name="full_name" placeholder="Full name" required />
      <Input name="phone" placeholder="Phone" required />
      <Input name="email" placeholder="Email" required />
      <Input name="dob" type="date" placeholder="Date of birth" required />
      <Input name="nationality" placeholder="Nationality" required />
      <Input name="current_address" placeholder="Current address" required />
      <Input
        name="company_or_university_name"
        placeholder="Company / University name"
        required
      />
      <Input
        name="company_address"
        placeholder="Company / University address"
        required
      />
      <Input name="occupation" placeholder="Occupation" required />
      <SubmitButton />
    </form>
  );
}
