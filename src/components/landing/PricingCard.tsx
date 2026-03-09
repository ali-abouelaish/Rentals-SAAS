"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { GlassPanel } from "./GlassPanel";

type PricingCardProps = {
  name: string;
  description: string;
  price: string;
  features: readonly string[];
  cta: string;
  highlighted?: boolean;
  index?: number;
};

export function PricingCard({
  name,
  description,
  price,
  features,
  cta,
  highlighted = false,
  index = 0,
}: PricingCardProps) {
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.32, delay: index * 0.06 }}
      whileHover={{ y: -5 }}
    >
      <GlassPanel
        strong={highlighted}
        className={cn(
          "relative rounded-2xl p-8 transition-all duration-200",
          highlighted
            ? "border-harbor-light-blue/70 ring-1 ring-harbor-light-blue/45 shadow-[0_0_38px_rgba(79,209,255,0.25)]"
            : "hover:harbor-glow-ring"
        )}
      >
        {highlighted ? (
          <p className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[linear-gradient(135deg,#4FD1FF,#103E73)] px-4 py-1 text-xs font-semibold text-white shadow-[0_0_20px_rgba(79,209,255,0.4)]">
            Recommended
          </p>
        ) : null}
        <h3 className="text-xl font-bold text-harbor-navy-deep">{name}</h3>
        <p className="mt-1 text-sm text-harbor-text-neutral">{description}</p>
        <p className="mt-6 text-2xl font-bold text-harbor-navy">{price}</p>
        <ul className="mt-6 space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-harbor-text-neutral">
              <Check className="h-5 w-5 flex-shrink-0 text-harbor-navy" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <a
            href="#contact"
            className={cn(
              "inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-base font-semibold transition-all duration-200",
              highlighted
                ? "bg-[linear-gradient(135deg,#4FD1FF_0%,#103E73_55%,#0B2F59_100%)] text-white shadow-[0_16px_36px_rgba(16,62,115,0.34)] hover:brightness-110 hover:shadow-[0_0_40px_rgba(79,209,255,0.35)]"
                : "border border-harbor-light-blue/60 bg-white/60 text-harbor-navy backdrop-blur-xl hover:bg-white/80 hover:shadow-[0_0_28px_rgba(79,209,255,0.22)]"
            )}
          >
            {cta}
          </a>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
