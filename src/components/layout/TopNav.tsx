import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions/auth";

export function TopNav({ profileName, role }: { profileName: string; role: string }) {
  return (
    <header className="border-b border-muted bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-heading text-lg font-semibold text-brand">
            Rental Agency SaaS
          </p>
          <p className="text-xs text-gray-500">Premium multi-tenant workspace</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-full border border-muted p-2 text-gray-600">
            <Bell size={16} />
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut size={14} className="mr-2" />
              Logout
            </Button>
          </form>
          <div className="text-right">
            <p className="text-sm font-medium text-brand">{profileName}</p>
            <p className="text-xs text-gray-500">{role.replace("_", " ")}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
