import Image from "next/image";
import { cn } from "@/lib/utils/cn";

const sizeMap = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

export function AvatarCircle({
  name,
  url,
  size = "md",
}: {
  name: string;
  url?: string | null;
  size?: keyof typeof sizeMap | number;
}) {
  const px = typeof size === "number" ? size : sizeMap[size];
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-brand-subtle text-brand text-xs font-semibold"
      )}
      style={{ width: px, height: px }}
    >
      {url ? (
        <Image src={url} alt={name} width={px} height={px} className="rounded-full" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
