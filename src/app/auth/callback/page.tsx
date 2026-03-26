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

  // Listen for PASSWORD_RECOVERY event — Supabase fires this whenever a code/token
  // exchange results in a recovery session, regardless of the `type` param in the URL.
  // This handles unconfirmed users (invited but not yet accepted) whose reset email
  // may carry type=signup or type=email instead of type=recovery.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/reset-password");
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && mounted) {
          if (type === "invite") {
            router.replace(`/invite/accept?error=${encodeURIComponent(error.message)}`);
          } else {
            router.replace("/login");
          }
          return;
        }
        if (type === "invite" && mounted) {
          router.replace("/invite/set-password");
          return;
        }
      } else if (tokenHash && type === "invite") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite",
        });
        if (error && mounted) {
          router.replace(`/invite/accept?error=${encodeURIComponent(error.message)}`);
          return;
        }
      } else if (tokenHash && (type === "recovery" || type === "signup" || type === "email")) {
        // type=signup or type=email can be sent by Supabase for unconfirmed users
        // (invited but not yet accepted) going through password recovery.
        const otpType = type as "recovery" | "signup" | "email";
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (error && mounted) {
          router.replace(`/forgot-password?error=${encodeURIComponent(error.message)}`);
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
