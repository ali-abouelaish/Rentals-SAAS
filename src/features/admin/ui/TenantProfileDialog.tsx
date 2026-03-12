"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
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
import { upsertTenantAccessProfileAction } from "../actions/admin";
import type { TenantAccessProfile } from "../domain/types";

const permissionKeys = [
  "clients.view",
  "clients.manage",
  "rentals.view",
  "rentals.manage",
  "invoices.view",
  "invoices.manage",
  "bonuses.view",
  "bonuses.manage",
  "agents.view",
  "agents.manage"
] as const;

export function TenantProfileDialog({
  tenantId,
  profile
}: {
  tenantId: string;
  profile?: TenantAccessProfile;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [permissions, setPermissions] = useState<Record<string, boolean>>(profile?.permissions ?? {});

  const isEdit = Boolean(profile);

  const selectedCount = useMemo(
    () => Object.values(permissions).filter(Boolean).length,
    [permissions]
  );

  const onSave = () => {
    startTransition(async () => {
      const result = await upsertTenantAccessProfileAction({
        tenantId,
        profileId: profile?.id,
        name,
        description,
        permissions
      });
      if (!result.ok) {
        toast.error("Unable to save profile", { description: result.error });
        return;
      }
      toast.success(isEdit ? "Profile updated" : "Profile created");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "outline" : "default"} size="sm">
          {isEdit ? <Pencil className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
          {isEdit ? "Edit" : "New Profile"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Access Profile" : "Create Access Profile"}</DialogTitle>
          <DialogDescription>
            Define reusable permissions that can be assigned to tenant users.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Profile Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Operations Manager"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Can manage rentals and invoices"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">Permissions</p>
              <p className="text-xs text-foreground-muted">{selectedCount} selected</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {permissionKeys.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-foreground-secondary">
                  <input
                    type="checkbox"
                    checked={Boolean(permissions[key])}
                    onChange={(e) =>
                      setPermissions((prev) => ({
                        ...prev,
                        [key]: e.target.checked
                      }))
                    }
                  />
                  {key}
                </label>
              ))}
            </div>
          </div>

          <Button onClick={onSave} disabled={isPending || !name.trim()}>
            {isEdit ? "Save Profile" : "Create Profile"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

