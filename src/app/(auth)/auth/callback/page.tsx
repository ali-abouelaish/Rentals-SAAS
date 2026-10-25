import type { Metadata } from "next";
import { DoorShell } from "@/features/auth/ui/door/DoorShell";
import { Plate } from "@/features/auth/ui/door/Plate";
import { AuthCallback } from "@/features/auth/ui/AuthCallback";
import { safeNextPath } from "@/lib/auth/safeNext";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Signing you in",
};

/** Where Supabase's email links land (reset, invite, confirm). See AuthCallback for the hand-off. */
export default function AuthCallbackPage({
  searchParams,
}: {
  searchParams?: { next?: string; code?: string; token_hash?: string; type?: string };
}) {
  return (
    <DoorShell knocker>
      <Plate title="One moment." sub="Opening the link from your email.">
        <p className="plate__wait" role="status">
          <span className="spin" aria-hidden="true" />
          Signing you in…
        </p>
        <AuthCallback
          next={safeNextPath(searchParams?.next) ?? "/me"}
          code={searchParams?.code ?? null}
          tokenHash={searchParams?.token_hash ?? null}
          type={searchParams?.type ?? null}
        />
      </Plate>
    </DoorShell>
  );
}
