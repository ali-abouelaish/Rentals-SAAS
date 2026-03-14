"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createLandlord } from "@/features/landlords/actions/landlords";
import { toast } from "sonner";

export function CreateLandlordForm() {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    try {
      await createLandlord(formData);
      // redirect() in action navigates away
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create landlord");
      setIsPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <Input name="name" placeholder="Name" required />
      <Input name="contact" placeholder="Contact" />
      <Input name="billing_address" placeholder="Billing address" />
      <Input name="email" placeholder="Email" type="email" />
      <Input
        name="spareroom_profile_url"
        placeholder="Spareroom profile URL"
      />
      <div>
        <label className="text-xs text-foreground-secondary">Pays commission</label>
        <select
          name="pays_commission"
          defaultValue="yes"
          className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm"
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <Input
        name="commission_amount_gbp"
        type="number"
        step="0.01"
        defaultValue="0"
        placeholder="Commission amount (£)"
      />
      <Input
        name="commission_term_text"
        placeholder="Commission term text (e.g. 1 week)"
      />
      <div>
        <label className="text-xs text-foreground-secondary">We do viewing</label>
        <select
          name="we_do_viewing"
          defaultValue="yes"
          className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm"
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <Textarea name="profile_notes" placeholder="Profile notes" />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create landlord"}
        </Button>
      </div>
    </form>
  );
}
