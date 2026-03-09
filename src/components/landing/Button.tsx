"use client";

import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  type,
  ...props
}: ButtonProps) {
  const base =
    "relative inline-flex items-center justify-center overflow-hidden font-semibold rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-light-blue/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary:
      "bg-[linear-gradient(135deg,#4FD1FF_0%,#103E73_52%,#0B2F59_100%)] text-white shadow-[0_14px_34px_rgba(16,62,115,0.35)] hover:brightness-110 hover:shadow-[0_0_40px_rgba(79,209,255,0.35)]",
    secondary:
      "glass-panel text-harbor-navy-deep hover:shadow-[0_0_32px_rgba(79,209,255,0.2)]",
    outline:
      "border border-harbor-light-blue/60 text-harbor-navy bg-white/60 backdrop-blur-xl hover:bg-white/80 hover:shadow-[0_0_28px_rgba(79,209,255,0.2)]",
    ghost: "text-harbor-navy hover:bg-harbor-light-blue/10",
  };
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <motion.button
      type={type ?? "button"}
      className={cn(base, variants[variant], sizes[size], className)}
      whileHover={{ y: -1, scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      {...props}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.38),transparent_55%)] opacity-70" />
      <span className="relative z-[1] inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}
