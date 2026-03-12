"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTenantAccessProfileAction } from "../actions/admin";

export function DeleteTenantProfileButton({
  tenantId,
  profileId,
  profileName,
  disabled
}: {
  tenantId: string;
  profileId: string;
  profileName: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    const confirmed = window.confirm(
      `Delete profile "${profileName}"? Assigned users will be set to "No profile".`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteTenantAccessProfileAction({
        tenantId,
        profileId
      });
      if (!result.ok) {
        toast.error("Unable to delete profile", { description: result.error });
        return;
      }
      toast.success("Profile deleted");
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      onClick={onDelete}
      disabled={isPending || disabled}
    >
      Delete
    </Button>
  );
}

