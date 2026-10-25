import type { Metadata } from "next";
import { getDoorContext } from "@/features/auth/data/door";
import { DoorShell } from "@/features/auth/ui/door/DoorShell";
import { Plate } from "@/features/auth/ui/door/Plate";
import { LoginForm } from "@/features/auth/ui/LoginForm";
import { safeNextPath } from "@/lib/auth/safeNext";

// The login page reads search params and drives an auth cookie write; there is
// nothing to gain from prerendering it, and the static export of this route
// group has intermittently failed to resolve its client-reference manifest.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Harbor workspace.",
};

// Signed-in visitors never see this page: middleware forwards them to their workspace.
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; disabled?: string };
}) {
  const { brandName } = await getDoorContext();

  return (
    <DoorShell knocker switchLink={{ lead: "New to Harbor?", label: "Request a demo", href: "/signup" }}>
      <Plate
        title="Welcome back."
        sub="Your rooms are right where you left them."
        brandLine={brandName ? `Sign in to ${brandName}` : null}
      >
        <LoginForm
          // Deep-link destination preserved through the auth bounce (e.g. a landlord link).
          next={safeNextPath(searchParams?.next)}
          disabledNotice={searchParams?.disabled === "1"}
        />
      </Plate>
    </DoorShell>
  );
}
