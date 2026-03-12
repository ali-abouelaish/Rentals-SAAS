"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();
  const next = searchParams.get("next") ?? "/me";
  const code = searchParams.get("code");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      // Handle PKCE/code flow links if present.
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else {
        // This also initializes hash-based recovery links if used.
        await supabase.auth.getSession();
      }
      if (mounted) {
        router.replace(next);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [router, next, code, supabase]);

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
