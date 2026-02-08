"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { ReactNode } from "react";

interface PremiumButtonProps extends HTMLMotionProps<"button"> {
    children: ReactNode;
    variant?: "primary" | "accent" | "ghost" | "glass";
    size?: "sm" | "md" | "lg";
}

export function PremiumButton({
    children,
    className,
    variant = "primary",
    size = "md",
    ...props
}: PremiumButtonProps) {
    const variants = {
        primary: "bg-brand text-white shadow-lg shadow-brand/20 border border-transparent hover:bg-brand-900",
        accent: "bg-gradient-accent text-brand-900 font-bold shadow-glow border border-transparent hover:brightness-110",
        ghost: "bg-transparent text-brand hover:bg-surface-100",
        glass: "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-5 py-2.5 text-sm",
        lg: "px-8 py-3 text-base"
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
                "relative rounded-xl font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent",
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        >
            {children}
        </motion.button>
    );
}
