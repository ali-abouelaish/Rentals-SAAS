"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { setAgentDisabled } from "../actions/agents";

export function AgentDisableToggle({
  userId,
  isDisabled,
}: {
  userId: string;
  isDisabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleClick = () => {
    startTransition(async () => {
      try {
        await setAgentDisabled(userId, !isDisabled);
        toast({
          title: !isDisabled ? "Agent disabled" : "Agent re-enabled",
          description: !isDisabled
            ? "This agent will no longer appear in agent lists."
            : "This agent is active again.",
          variant: "success",
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        toast({
          title: "Unable to update agent",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error",
        });
      }
    });
  };

  return (
    <Button
      type="button"
      variant={isDisabled ? "outline" : "destructive"}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isDisabled ? "Re-enable agent" : "Disable agent"}
    </Button>
  );
}

