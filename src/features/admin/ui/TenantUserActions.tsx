"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  assignTenantUserProfileAction,
  resendInviteForUserAction,
  setTenantUserRoleAction,
  setTenantUserStatusAction
} from "../actions/admin";
import type { TenantAccessProfile, TenantUserListItem } from "../domain/types";

const roleOptions = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "agent", label: "Agent" },
  { value: "marketing_only", label: "Marketing Only" },
  { value: "agent_and_marketing", label: "Agent + Marketing" }
];

export function TenantUserActions({
  tenantId,
  user,
  profiles
}: {
  tenantId: string;
  user: TenantUserListItem;
  profiles: TenantAccessProfile[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onRoleChange = (value: string) => {
    startTransition(async () => {
      const result = await setTenantUserRoleAction({
        tenantId,
        userId: user.id,
        role: value
      });
      if (!result.ok) {
        toast.error("Unable to update role", { description: result.error });
        return;
      }
      toast.success("Role updated");
      router.refresh();
    });
  };

  const onProfileChange = (value: string) => {
    startTransition(async () => {
      const result = await assignTenantUserProfileAction({
        tenantId,
        userId: user.id,
        profileId: value === "none" ? null : value
      });
      if (!result.ok) {
        toast.error("Unable to assign profile", { description: result.error });
        return;
      }
      toast.success("Profile assignment updated");
      router.refresh();
    });
  };

  const onToggleStatus = () => {
    const next = !user.is_active;
    const confirmed = window.confirm(
      next ? "Activate this user?" : "Deactivate this user?"
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await setTenantUserStatusAction({
        tenantId,
        userId: user.id,
        isActive: next
      });
      if (!result.ok) {
        toast.error("Unable to update user status", { description: result.error });
        return;
      }
      toast.success(next ? "User activated" : "User deactivated");
      router.refresh();
    });
  };

  const onResendInvite = () => {
    startTransition(async () => {
      const result = await resendInviteForUserAction({
        tenantId,
        userId: user.id
      });
      if (!result.ok) {
        toast.error("Unable to resend invite", { description: result.error });
        return;
      }
      toast.success("Invite email sent");
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={user.role}
        onChange={onRoleChange}
        options={roleOptions}
        className="h-8 min-w-[150px] text-xs"
        disabled={isPending}
      />
      <Select
        value={user.profile_id ?? "none"}
        onChange={onProfileChange}
        options={[
          { value: "none", label: "No profile" },
          ...profiles.map((profile) => ({ value: profile.id, label: profile.name }))
        ]}
        className="h-8 min-w-[170px] text-xs"
        disabled={isPending}
      />
      <Button
        type="button"
        size="sm"
        variant={user.is_active ? "outline" : "success"}
        onClick={onToggleStatus}
        disabled={isPending}
      >
        {user.is_active ? "Deactivate" : "Activate"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onResendInvite}
        disabled={isPending}
      >
        Resend Invite
      </Button>
    </div>
  );
}

