import type { Metadata } from "next";
import { getDoorContext } from "@/features/auth/data/door";
import { DoorShell } from "@/features/auth/ui/door/DoorShell";
import { ArrowIcon } from "@/features/auth/ui/door/icons";
import { Plate } from "@/features/auth/ui/door/Plate";

export const metadata: Metadata = {
  title: "Invitation problem",
};

const REASON_MESSAGES: Record<string, string> = {
  missing_token:
    "This link is missing verification details. Please use the exact link from your invitation email.",
  invalid_or_expired:
    "This invite link is invalid or has expired. Ask an admin to resend your invitation.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason ?? null;
  const message =
    (reason && REASON_MESSAGES[reason]) ||
    "Something went wrong. Please try again or contact support.";
  const { brandName } = await getDoorContext();

  return (
    <DoorShell knocker>
      <Plate title="That link didn’t work." brandLine={brandName ? `Sign in to ${brandName}` : null}>
        <div className="alert" role="alert">
          <p>{message}</p>
        </div>
        <div className="plate__actions">
          <a className="submit" href="/login">
            <span className="submit__label">Back to sign in</span>
            <ArrowIcon />
          </a>
        </div>
      </Plate>
    </DoorShell>
  );
}
