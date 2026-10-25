import type { Metadata } from "next";
import { getDoorContext } from "@/features/auth/data/door";
import { DoorShell } from "@/features/auth/ui/door/DoorShell";
import { Plate } from "@/features/auth/ui/door/Plate";
import { ForgotPasswordForm } from "@/features/auth/ui/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a link to choose a new Harbor password.",
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams?: { error?: string } }) {
  const { brandName } = await getDoorContext();

  return (
    <DoorShell knocker switchLink={{ lead: "New to Harbor?", label: "Request a demo", href: "/signup" }}>
      <Plate
        title="Reset your password."
        sub="We’ll email you a link to choose a new one."
        brandLine={brandName ? `Sign in to ${brandName}` : null}
      >
        {/* ?error= comes back from /auth/callback when a reset link has expired or been used */}
        <ForgotPasswordForm initialError={searchParams?.error ? String(searchParams.error).slice(0, 300) : null} />
      </Plate>
    </DoorShell>
  );
}
