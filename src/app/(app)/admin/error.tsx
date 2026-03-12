"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <Card>
      <CardContent className="py-14 text-center">
        <AlertTriangle className="h-10 w-10 mx-auto text-warning mb-3" />
        <p className="text-lg font-semibold text-foreground">Unable to load admin data</p>
        <p className="text-sm text-foreground-secondary mt-1">
          Please retry. If this keeps happening, check your migration/state and permissions.
        </p>
        <Button className="mt-4" onClick={reset}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

