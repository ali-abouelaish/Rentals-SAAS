import Link from "next/link";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/formatters";
import { Pencil } from "lucide-react";

type ProfileHeaderProps = {
  displayName: string;
  role: string;
  avatarUrl?: string | null;
  joinedAt?: string | null;
  email?: string | null;
  phone?: string | null;
  onEdit?: () => void;
  editSupported?: boolean;
};

export function ProfileHeader({
  displayName,
  role,
  avatarUrl,
  joinedAt,
  email,
  phone,
  editSupported = false
}: ProfileHeaderProps) {
  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0">
            <AvatarCircle name={displayName} url={avatarUrl ?? undefined} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
              <span className="inline-flex items-center rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-medium text-brand capitalize">
                {role?.replaceAll("_", " ") ?? "Agent"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-foreground-muted">
              {joinedAt && (
                <span>Joined {formatDate(joinedAt)}</span>
              )}
              {email && <span>{email}</span>}
              {phone && <span>{phone}</span>}
            </div>
          </div>
        </div>
        {editSupported ? (
          <Button variant="outline" size="sm" asChild>
            <Link href="/me?tab=settings">
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit Profile
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled title="Edit in Settings tab">
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Edit Profile
          </Button>
        )}
      </div>
    </div>
  );
}
