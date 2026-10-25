import type { Metadata } from "next";
import { getDoorContext } from "@/features/auth/data/door";
import { DoorShell } from "@/features/auth/ui/door/DoorShell";
import { Plate } from "@/features/auth/ui/door/Plate";
import { InviteAccept } from "@/features/auth/ui/InviteAccept";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accept your invitation",
};

export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams?: { token_hash?: string; type?: string; error?: string };
}) {
  const { brandName } = await getDoorContext();

  return (
    <DoorShell knocker>
      <Plate
        title="You’ve been invited."
        sub={
          brandName
            ? `Accept to join ${brandName}'s workspace, then choose a password.`
            : "Accept to join your team’s workspace, then choose a password."
        }
        brandLine={brandName ? `Join ${brandName} on Harbor` : null}
      >
        <InviteAccept
          tokenHash={searchParams?.token_hash ?? null}
          type={searchParams?.type || "invite"}
          initialError={searchParams?.error ? String(searchParams.error).slice(0, 200) : null}
        />
      </Plate>
    </DoorShell>
  );
}
