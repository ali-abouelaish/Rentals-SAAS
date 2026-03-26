import type { ReactNode } from "react";
import { requireUserProfile } from "@/lib/auth/requireRole";

export default async function MeLayout({ children }: { children: ReactNode }) {
  await requireUserProfile();
  return <>{children}</>;
}

export const metadata = { title: "My Profile" };
