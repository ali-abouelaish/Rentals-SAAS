"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { ReactNode } from "react";

interface AnimatedCardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
    delay?: number;
}

export function AnimatedCard({ children, className, onClick, delay = 0 }: AnimatedCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: delay * 0.1, ease: "easeOut" }}
            whileHover={{ y: -5, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.15)" }}
            className={cn(
                "relative overflow-hidden rounded-2xl border border-surface-300 bg-surface-200 p-6 shadow-soft transition-colors",
                "hover:border-accent/40",
                className
            )}
            onClick={onClick}
        >
            {children}
        </motion.div>
    );
}
