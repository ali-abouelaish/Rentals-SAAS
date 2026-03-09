"use client";

import { SectionHeading } from "./SectionHeading";
import { HOW_IT_WORKS_STEPS } from "@/lib/landing-config";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { motion } from "framer-motion";
import { GlassPanel } from "./GlassPanel";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 harbor-divider">
      <div className="absolute inset-0 harbor-futuristic-bg" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Implementation Flow"
          title="How it works"
          subtitle="From onboarding to managing all your client portals in one place."
        />
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map(({ step, title, description }, i) => (
            <motion.div
              key={step}
              className="relative"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              whileHover={{ y: -3 }}
            >
              <GlassPanel
                className={cn(
                  "rounded-2xl p-6 transition-all duration-200",
                  "hover:harbor-glow-ring"
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-harbor-light-blue/45 bg-[linear-gradient(135deg,#4FD1FF,#103E73)] text-sm font-bold text-white shadow-[0_0_26px_rgba(79,209,255,0.35)]">
                  {step}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-harbor-navy-deep">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-harbor-text-neutral leading-relaxed">
                  {description}
                </p>
              </GlassPanel>
              {i < HOW_IT_WORKS_STEPS.length - 1 && (
                <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                  <ArrowRight className="h-5 w-5 text-harbor-light-blue" aria-hidden />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
