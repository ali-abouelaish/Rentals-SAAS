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
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else if (tokenHash && type === "invite") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite",
        });
        if (error && mounted) {
          router.replace(`/invite/accept?error=${encodeURIComponent(error.message)}`);
          return;
        }
      } else {
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
  }, [router, next, code, tokenHash, type, supabase]);

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
