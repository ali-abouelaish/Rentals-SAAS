"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateAgencyContactEmail } from "../actions/contactEmail";

export function AgencyContactEmailCard({ initialEmail }: { initialEmail: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateAgencyContactEmail(formData);
      if (!result.ok) {
        toast.error("Unable to save", { description: result.error ?? "Please try again." });
        return;
      }
      toast.success("Contact email saved");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Agency contact email</h3>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Where we send system updates, maintenance windows and account notices for your agency.
          </p>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label
              htmlFor="contact_email"
              className="block text-xs font-medium text-foreground-muted mb-1.5"
            >
              Email address
            </label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              placeholder="agency@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              required
            />
          </div>
          <Button type="submit" disabled={isPending}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
