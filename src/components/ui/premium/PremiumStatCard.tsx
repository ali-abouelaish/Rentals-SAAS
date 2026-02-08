"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface PremiumStatCardProps {
    label: string;
    value: string;
    icon?: React.ReactNode;
    trend?: string;
    trendUp?: boolean;
    variant?: "primary" | "accent" | "glass" | "navy";
    delay?: number;
}

export function PremiumStatCard({
    label,
    value,
    icon,
    trend,
    trendUp,
    variant = "glass",
    delay = 0
}: PremiumStatCardProps) {

    const variants = {
        glass: "bg-surface-200 border-surface-300 text-brand-900",
        primary: "bg-brand text-white border-brand-800",
        accent: "bg-gradient-accent text-brand-900 border-accent/20",
        navy: "bg-brand-900 text-white border-brand-800"
    };

    const iconStyles = {
        glass: "text-brand bg-brand/10",
        primary: "text-white bg-white/10",
        accent: "text-brand-900 bg-white/30",
        navy: "text-accent bg-accent/10"
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: delay * 0.1 }}
            whileHover={{ y: -5, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.15)" }}
            className={cn(
                "relative overflow-hidden rounded-2xl border p-6 shadow-soft transition-colors",
                variants[variant]
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className={cn("text-xs font-semibold uppercase tracking-wider opacity-70 mb-1")}>
                        {label}
                    </p>
                    <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
                    {trend && (
                        <div className={cn("mt-2 flex items-center text-xs font-medium", trendUp ? "text-green-500" : "text-red-500")}>
                            <span>{trend}</span>
                        </div>
                    )}
                </div>
                {icon && (
                    <div className={cn("rounded-xl p-3", iconStyles[variant])}>
                        {icon}
                    </div>
                )}
            </div>

            {/* Decorative Gradient Blob */}
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />
        </motion.div>
    );
}
