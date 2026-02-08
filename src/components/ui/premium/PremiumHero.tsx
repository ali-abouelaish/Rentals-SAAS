"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface PremiumHeroProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}

export function PremiumHero({ title, subtitle, action }: PremiumHeroProps) {
    return (
        <div className="flex flex-col gap-4 pb-8 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
                <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-3xl font-bold tracking-tight text-brand-900 md:text-4xl"
                >
                    {title}
                </motion.h1>
                {subtitle && (
                    <motion.p
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-lg text-muted-foreground"
                    >
                        {subtitle}
                    </motion.p>
                )}
            </div>
            {action && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    {action}
                </motion.div>
            )}
        </div>
    );
}
