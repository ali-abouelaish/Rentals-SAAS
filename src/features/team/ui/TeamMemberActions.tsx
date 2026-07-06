"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendTeamInvite, setTeamMemberActive } from "../actions/team";
import type { TeamMember } from "../data/team";

export function TeamMemberActions({
  member,
  isSelf
}: {
  member: TeamMember;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onResend = () => {
    startTransition(async () => {
      const result = await resendTeamInvite(member.id);
      if (!result.ok) {
        toast.error("Unable to resend invite", { description: result.error });
        return;
      }
      toast.success("Invitation re-sent", { description: member.email ?? undefined });
    });
  };

  const onToggleActive = () => {
    const next = member.status === "disabled";
    const confirmed = window.confirm(
      next
        ? `Re-activate ${member.display_name}? They will be able to sign in again.`
        : `Deactivate ${member.display_name}? They will be signed out and blocked from signing in.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await setTeamMemberActive(member.id, next);
      if (!result.ok) {
        toast.error("Unable to update user", { description: result.error });
        return;
      }
      toast.success(next ? "User re-activated" : "User deactivated");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {member.status === "pending" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onResend}
          disabled={isPending}
          title="Send the invitation email again"
        >
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Resend invite
        </Button>
      )}

      {isSelf ? (
        <span
          className="text-xs text-foreground-muted"
          title="You can't deactivate your own account."
        >
          You
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant={member.status === "disabled" ? "success" : "outline"}
          onClick={onToggleActive}
          disabled={isPending}
          title={
            member.status === "disabled"
              ? "Allow this user to sign in again"
              : "Block this user from signing in"
          }
        >
          {member.status === "disabled" ? "Activate" : "Deactivate"}
        </Button>
      )}
    </div>
  );
}
