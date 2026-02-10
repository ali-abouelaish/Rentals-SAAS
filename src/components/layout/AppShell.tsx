import type { ReactNode } from "react";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { SideNav } from "./SideNav";

export async function AppShell({ children }: { children: ReactNode }) {
  const profile = await requireUserProfile();

  return (
    <div className="h-screen bg-surface-ground p-2 md:p-3 flex gap-3 overflow-hidden">
      {/* Sidebar */}
      <SideNav profile={profile} />

      {/* Main content — white rounded container */}
      <main className="flex-1 overflow-y-auto bg-surface-card rounded-bento shadow-bento">
        <div className="px-6 py-8 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
