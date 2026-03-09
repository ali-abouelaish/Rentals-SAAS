"use client";

import {
  Globe,
  Palette,
  LayoutDashboard,
  Shield,
  Activity,
  Layers,
  FileCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { SectionHeading } from "./SectionHeading";
import { FEATURES } from "@/lib/landing-config";
import { cn } from "@/lib/utils/cn";
import { GlassPanel } from "./GlassPanel";

const iconMap: Record<string, LucideIcon> = {
  Globe,
  Palette,
  LayoutDashboard,
  Shield,
  Activity,
  Layers,
  FileCheck,
  Zap,
};

export function Features() {
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="absolute inset-0 harbor-futuristic-bg" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Core Capabilities"
          title="Built for multi-tenant operations"
          subtitle="One platform, many client workspaces. Subdomains, branding, and control in one place."
        />
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ title, description, icon: iconName }) => {
            const Icon = iconMap[iconName] ?? Globe;
            return (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.3 }}
                whileHover={{ y: -4 }}
              >
                <GlassPanel
                  className={cn(
                    "group h-full rounded-2xl p-6 transition-all duration-200",
                    "hover:harbor-glow-ring"
                  )}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-harbor-light-blue/35 bg-white/60 text-harbor-navy shadow-[0_0_22px_rgba(79,209,255,0.16)]">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-harbor-navy-deep">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm text-harbor-text-neutral leading-relaxed">
                    {description}
                  </p>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
