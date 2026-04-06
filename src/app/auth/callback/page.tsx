"use client";

import { useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const next = searchParams.get("next") ?? "/me";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      console.log("[callback] url params:", { code: !!code, tokenHash: !!tokenHash, type, next, fullUrl: window.location.href });
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        console.log("[callback] exchange result:", { error: error?.message, status: error?.status });
        if (!mounted) return;

        if (error) {
          // In React StrictMode (dev), effects fire twice — the first call may have
          // already consumed the single-use code. If a session exists, the exchange
          // succeeded in the previous invocation and we can proceed normally.
          const { data: { session } } = await supabase.auth.getSession();
          if (!mounted) return;
          if (session) {
            console.log("[callback] session exists after failed exchange (StrictMode) — proceeding to", next);
            router.replace(next);
            return;
          }

          if (type === "invite") {
            router.replace(`/invite/accept?error=${encodeURIComponent(error.message)}`);
          } else if (type === "recovery" || next === "/reset-password") {
            router.replace(`/forgot-password?error=${encodeURIComponent(error.message)}`);
          } else {
            router.replace("/login");
          }
          return;
        }

        if (type === "invite") {
          router.replace("/invite/set-password");
          return;
        }

        router.replace(next);
        return;
      }

      if (tokenHash && type === "invite") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite",
        });
        if (!mounted) return;
        if (error) {
          router.replace(`/invite/accept?error=${encodeURIComponent(error.message)}`);
          return;
        }
        router.replace("/invite/set-password");
        return;
      }

      if (tokenHash && (type === "recovery" || type === "signup" || type === "email")) {
        // type=signup or type=email can be sent by Supabase for unconfirmed users
        // (invited but not yet accepted) going through password recovery.
        const otpType = type as "recovery" | "signup" | "email";
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (!mounted) return;
        if (error) {
          router.replace(`/forgot-password?error=${encodeURIComponent(error.message)}`);
          return;
        }
        router.replace("/reset-password");
        return;
      }

      // Generic: just refresh session and go to next
      await supabase.auth.getSession();
      if (mounted) router.replace(next);
    };

    run();
    return () => { mounted = false; };
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
