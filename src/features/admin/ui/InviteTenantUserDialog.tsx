"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { inviteTenantUserAction } from "../actions/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "agent", label: "Agent" },
  { value: "marketing_only", label: "Marketing Only" },
  { value: "super_admin", label: "Super Admin" }
];

export function InviteTenantUserDialog({
  tenantId,
  tenantName
}: {
  tenantId: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("admin");
  const [emailError, setEmailError] = useState<string | null>(null);

  const onSubmit = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(null);

    startTransition(async () => {
      const result = await inviteTenantUserAction({
        tenantId,
        email: trimmed,
        displayName,
        role
      });
      if (!result.ok) {
        toast.error("Could not invite user", {
          description: result.error ?? "Please try again."
        });
        return;
      }

      toast.success("Invitation sent", {
        description: `${trimmed} will receive an email to set their password.`
      });
      setEmail("");
      setDisplayName("");
      setRole("admin");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite user to {tenantName}</DialogTitle>
          <DialogDescription>
            Send an email invite so this person can create a login for this tenant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="invite-name" className="text-sm font-medium text-foreground">
              Display name (optional)
            </label>
            <p className="text-xs text-foreground-muted">
              Falls back to the email prefix if left blank.
            </p>
            <Input
              id="invite-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jordan Smith"
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <p className="text-xs text-foreground-muted">
              The invite is sent here. Must not already have an account. Format: name@example.com
            </p>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              placeholder="colleague@example.com"
              disabled={isPending}
              aria-invalid={Boolean(emailError)}
            />
            {emailError && <p className="text-xs text-error">{emailError}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-role" className="text-sm font-medium text-foreground">
              Role
            </label>
            <p className="text-xs text-foreground-muted">
              Admin can access all tenant tools. Super Admin grants full platform access.
            </p>
            <Select
              value={role}
              onChange={setRole}
              options={roleOptions}
              disabled={isPending}
            />
          </div>

          <Button onClick={onSubmit} disabled={isPending} loading={isPending} className="w-full">
            Send invitation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
