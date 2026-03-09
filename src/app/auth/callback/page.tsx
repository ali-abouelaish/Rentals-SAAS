"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/me";

  useEffect(() => {
    // Supabase has set the session from the hash; redirect to app
    router.replace(next);
  }, [router, next]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-app">
      <p className="text-foreground-muted">Redirecting...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-surface-app"><p className="text-foreground-muted">Loading...</p></div>}>
      <CallbackContent />
    </Suspense>
  );
}
