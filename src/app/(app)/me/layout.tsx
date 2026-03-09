import type { ReactNode } from "react";
import { requireAgentOnly } from "@/lib/auth/requireRole";

/** Only agents can access /me; admins are redirected to /earnings. */
export default async function MeLayout({ children }: { children: ReactNode }) {
  await requireAgentOnly();
  return <>{children}</>;
}

export const metadata = { title: "My Profile" };
