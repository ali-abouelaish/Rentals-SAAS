import type { ReactNode } from "react";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { TopNav } from "./TopNav";
import { SideNav } from "./SideNav";

export async function AppShell({ children }: { children: ReactNode }) {
  const profile = await requireUserProfile();

  return (
    <div className="min-h-screen">
      <TopNav profileName={profile.display_name ?? "Agent"} role={profile.role} />
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <SideNav role={profile.role} />
        <main className="flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
