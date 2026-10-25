import type { Metadata } from "next";
import { getDoorContext } from "@/features/auth/data/door";
import { DoorShell } from "@/features/auth/ui/door/DoorShell";
import { Plate } from "@/features/auth/ui/door/Plate";
import { NewPasswordForm } from "@/features/auth/ui/NewPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set your password",
};

/** The last step of accepting an invite: the invite link has already signed the person in. */
export default async function InviteSetPasswordPage() {
  const { brandName } = await getDoorContext();

  return (
    <DoorShell knocker>
      <Plate
        title="Set your password."
        sub="Choose a password to activate your account."
        brandLine={brandName ? `Join ${brandName} on Harbor` : null}
      >
        <NewPasswordForm mode="invite" />
      </Plate>
    </DoorShell>
  );
}
