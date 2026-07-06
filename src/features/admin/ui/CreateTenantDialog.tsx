"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createTenantAction } from "../actions/admin";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const onSubmit = () => {
    const email = contactEmail.trim();
    if (!email) {
      setEmailError("Contact email is required");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(null);

    startTransition(async () => {
      const result = await createTenantAction({
        name,
        slug: slug || name,
        contactEmail: email,
        status: "active"
      });
      if (!result.ok) {
        toast.error("Could not create tenant", {
          description: result.error ?? "Please try again."
        });
        return;
      }

      toast.success("Tenant created", {
        description: "New tenant has been created successfully."
      });
      setName("");
      setSlug("");
      setContactEmail("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          New Tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Tenant</DialogTitle>
          <DialogDescription>
            Add a new tenant workspace. Slug will be used for tenant URL mapping.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="tenant-name" className="text-sm font-medium text-foreground">
              Tenant Name
            </label>
            <p className="text-xs text-foreground-muted">The agency&apos;s display name.</p>
            <Input
              id="tenant-name"
              value={name}
              onChange={(e) => {
                const next = e.target.value;
                setName(next);
                if (!slug) setSlug(toSlug(next));
              }}
              placeholder="Acme Lettings"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tenant-slug" className="text-sm font-medium text-foreground">
              Slug
            </label>
            <p className="text-xs text-foreground-muted">
              Used for the tenant URL (<code>slug.harborops.co.uk</code>). Lowercase, hyphenated.
            </p>
            <Input
              id="tenant-slug"
              value={slug}
              onChange={(e) => setSlug(toSlug(e.target.value))}
              placeholder="acme-lettings"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tenant-contact-email" className="text-sm font-medium text-foreground">
              Contact Email
            </label>
            <p className="text-xs text-foreground-muted">
              Primary billing/admin contact for the agency. Format: name@example.com
            </p>
            <Input
              id="tenant-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              placeholder="admin@acme-lettings.com"
              disabled={isPending}
              aria-invalid={Boolean(emailError)}
            />
            {emailError && <p className="text-xs text-error">{emailError}</p>}
          </div>
          <Button
            onClick={onSubmit}
            disabled={isPending || !name.trim()}
            className="w-full"
          >
            Create tenant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

