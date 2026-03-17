"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RoomEnhancerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  const isPayloadTooLarge =
    error.message?.includes("413") ||
    error.message?.toLowerCase().includes("too large") ||
    error.message?.toLowerCase().includes("payload");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="rounded-full bg-status-error-bg p-4">
        <AlertTriangle className="h-8 w-8 text-status-error-fg" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {isPayloadTooLarge ? "Image too large" : "Something went wrong"}
        </h1>
        <p className="text-sm text-foreground-secondary max-w-sm">
          {isPayloadTooLarge
            ? "The image you uploaded is too large to process. Please try a smaller or lower-resolution image."
            : "An unexpected error occurred in the Room Enhancer."}
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Go back
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
