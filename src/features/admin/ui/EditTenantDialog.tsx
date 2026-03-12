"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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
import { updateTenantAction } from "../actions/admin";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function EditTenantDialog({
  tenantId,
  initialName,
  initialSlug
}: {
  tenantId: string;
  initialName: string;
  initialSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);

  const onSave = () => {
    startTransition(async () => {
      const result = await updateTenantAction({
        tenantId,
        name,
        slug
      });
      if (!result.ok) {
        toast.error("Unable to update tenant", {
          description: result.error ?? "Please try again."
        });
        return;
      }
      toast.success("Tenant updated");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Tenant</DialogTitle>
          <DialogDescription>Update tenant name and slug.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tenant Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tenant name"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Slug</label>
            <Input
              value={slug}
              onChange={(e) => setSlug(toSlug(e.target.value))}
              placeholder="tenant-slug"
              disabled={isPending}
            />
          </div>
          <Button onClick={onSave} disabled={isPending || !name.trim() || !slug.trim()} className="w-full">
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

