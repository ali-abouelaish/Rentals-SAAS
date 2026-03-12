"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { inviteSuperAdminAction } from "../actions/admin";

const CONFIRM_TEXT = "INVITE SUPER ADMIN";

export function InviteSuperAdminDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmInput, setConfirmInput] = useState("");

  const canSubmit = email.trim().length > 0 && confirmInput.trim() === CONFIRM_TEXT;

  const onInvite = () => {
    // Multiple confirmation prompts as requested.
    const first = window.confirm(
      "Grant SUPER ADMIN access?\n\nThis gives full internal control across all tenants."
    );
    if (!first) return;

    const second = window.confirm(
      "Final warning: this user can manage all tenant data, users, and features.\n\nContinue?"
    );
    if (!second) return;

    const third = window.prompt(
      `Type "${CONFIRM_TEXT}" to proceed.`,
      ""
    );
    if ((third ?? "").trim() !== CONFIRM_TEXT) {
      toast.error("Confirmation text did not match. Invite cancelled.");
      return;
    }

    startTransition(async () => {
      const result = await inviteSuperAdminAction({
        email,
        displayName
      });
      if (!result.ok) {
        toast.error("Unable to invite super admin", {
          description: result.error ?? "Please try again."
        });
        return;
      }

      toast.success("Super admin invite sent", {
        description: `Invite email sent to ${email}.`
      });
      setEmail("");
      setDisplayName("");
      setConfirmInput("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <ShieldAlert className="h-4 w-4 mr-1.5" />
          Invite Super Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Super Admin</DialogTitle>
          <DialogDescription>
            Use this only for trusted internal operators. This grants full platform access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Display name (optional)</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Platform Admin"
              disabled={isPending}
            />
          </div>
          <div className="rounded-lg border border-warning-border bg-warning-bg p-3 text-xs text-warning-fg">
            <p className="font-medium">High-privilege action</p>
            <p className="mt-1">
              This user can access all tenants, users, features, and internal admin tools.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Type <span className="font-mono">{CONFIRM_TEXT}</span> to enable invite
            </label>
            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={CONFIRM_TEXT}
              disabled={isPending}
            />
          </div>
          <Button
            type="button"
            onClick={onInvite}
            disabled={isPending || !canSubmit}
            className="w-full"
            variant="destructive"
          >
            Send super admin invite
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

