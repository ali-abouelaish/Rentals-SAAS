"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setTenantStatusAction } from "../actions/admin";

export function TenantStatusActionButton({
  tenantId,
  currentStatus
}: {
  tenantId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const targetStatus = currentStatus === "active" ? "suspended" : "active";
  const isSuspending = targetStatus === "suspended";

  const handleClick = () => {
    const confirmed = window.confirm(
      isSuspending
        ? "Suspend this tenant? Their workspace will be marked inactive."
        : "Reactivate this tenant?"
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await setTenantStatusAction({
        tenantId,
        status: targetStatus
      });
      if (!result.ok) {
        toast.error("Unable to update tenant status", {
          description: result.error ?? "Please try again."
        });
        return;
      }
      toast.success(targetStatus === "active" ? "Tenant activated" : "Tenant suspended");
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant={isSuspending ? "destructive" : "success"}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isSuspending ? "Suspend Tenant" : "Activate Tenant"}
    </Button>
  );
}

