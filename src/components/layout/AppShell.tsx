import type { ReactNode } from "react";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { TopNav } from "./TopNav";
import { SideNav } from "./SideNav";

export async function AppShell({ children }: { children: ReactNode }) {
  const profile = await requireUserProfile();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SideNav profile={profile} />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
}
