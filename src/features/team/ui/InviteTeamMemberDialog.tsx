"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ShieldCheck } from "lucide-react";
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
import { teamInviteSchema, type TeamInviteValues } from "../domain/schemas";
import { inviteTeamMember } from "../actions/team";

export function InviteTeamMemberDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<TeamInviteValues>({
    resolver: zodResolver(teamInviteSchema),
    defaultValues: { display_name: "", email: "", role: "admin" }
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = form;

  const onSubmit = (values: TeamInviteValues) => {
    startTransition(async () => {
      const result = await inviteTeamMember(values);
      if (!result.ok) {
        toast.error("Could not invite user", {
          description: result.error ?? "Something went wrong. Please try again.",
          duration: 6000
        });
        return;
      }
      reset({ display_name: "", email: "", role: "admin" });
      setOpen(false);
      toast.success("Invitation sent", {
        description: `${values.email} will receive an email to set their password and sign in.`,
        duration: 6000
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            Send an email invitation so a colleague can create their own login for this account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="team-name" className="block text-sm font-medium text-foreground">
              Full name
            </label>
            <p className="text-xs text-foreground-muted">
              The name shown across the app. Max 120 characters.
            </p>
            <Input
              id="team-name"
              placeholder="e.g. Jordan Smith"
              autoComplete="off"
              disabled={isPending}
              aria-invalid={Boolean(errors.display_name)}
              {...register("display_name")}
            />
            {errors.display_name && (
              <p className="text-xs text-error">{errors.display_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="team-email" className="block text-sm font-medium text-foreground">
              Email address
            </label>
            <p className="text-xs text-foreground-muted">
              The invitation is sent here. It must not already have an account.
            </p>
            <Input
              id="team-email"
              type="email"
              placeholder="colleague@example.com"
              autoComplete="off"
              disabled={isPending}
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email && <p className="text-xs text-error">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">Role</span>
            <p className="text-xs text-foreground-muted">
              New members join as Admin. Admin is required to access the property-management tools.
            </p>
            <div
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground-secondary"
              title="Only the Admin role is available today. Admin unlocks all property-management pages; limited roles will come later."
            >
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span className="font-medium text-foreground">Admin</span>
            </div>
          </div>

          <div className="pt-1">
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              loading={isPending}
              disabled={isPending}
            >
              Send invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
