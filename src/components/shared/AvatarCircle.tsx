import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export function AvatarCircle({
  name,
  url,
  size = 32
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-muted text-xs font-semibold text-navy"
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image src={url} alt={name} width={size} height={size} className="rounded-full" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
