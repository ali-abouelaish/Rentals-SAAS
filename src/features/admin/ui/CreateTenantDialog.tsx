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

export function CreateTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const onSubmit = () => {
    startTransition(async () => {
      const result = await createTenantAction({ name, slug: slug || name, status: "active" });
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
            <label className="text-sm font-medium text-foreground">Tenant Name</label>
            <Input
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
            <label className="text-sm font-medium text-foreground">Slug</label>
            <Input
              value={slug}
              onChange={(e) => setSlug(toSlug(e.target.value))}
              placeholder="acme-lettings"
              disabled={isPending}
            />
          </div>
          <Button onClick={onSubmit} disabled={isPending || !name.trim()} className="w-full">
            Create tenant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

