import type { Metadata } from "next";
import { getDoorContext } from "@/features/auth/data/door";
import { DoorShell } from "@/features/auth/ui/door/DoorShell";
import { Plate } from "@/features/auth/ui/door/Plate";
import { NewPasswordForm } from "@/features/auth/ui/NewPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose a new password",
};

/** Reached from a password-reset email, via /auth/callback, which opens the recovery session. */
export default async function ResetPasswordPage() {
  const { brandName } = await getDoorContext();

  return (
    <DoorShell knocker>
      <Plate
        title="Choose a new password."
        sub="Then use it the next time you sign in."
        brandLine={brandName ? `Sign in to ${brandName}` : null}
      >
        <NewPasswordForm mode="reset" />
      </Plate>
    </DoorShell>
  );
}
