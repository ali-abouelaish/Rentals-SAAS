"use client";

import { useState } from "react";
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
  const [failed, setFailed] = useState(false);
  const px = typeof size === "number" ? size : sizeMap[size];
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const showImage = url && !failed;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-brand-subtle text-brand text-xs font-semibold overflow-hidden"
      )}
      style={{ width: px, height: px }}
    >
      {showImage ? (
        <img
          src={url}
          alt={name}
          width={px}
          height={px}
          className="rounded-full w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
