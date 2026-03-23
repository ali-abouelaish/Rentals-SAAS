"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface Props {
  connected?: string;
  error?: string;
}

export function SettingsToast({ connected, error }: Props) {
  useEffect(() => {
    if (connected === "1") {
      toast.success("Gmail connected successfully");
    }
    if (error === "gmail_auth_failed") {
      toast.error("Gmail connection failed. Please try again.");
    }
  }, [connected, error]);

  return null;
}
