"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "./SectionHeading";
import { SOLUTIONS } from "@/lib/landing-config";
import { cn } from "@/lib/utils/cn";
import { GlassPanel } from "./GlassPanel";

export function Solutions() {
  return (
    <section id="solutions" className="relative py-20 sm:py-28">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f4f8ff_0%,#eef6ff_60%,#f6faff_100%)]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Industry Use Cases"
          title="Solutions for every operation"
          subtitle="From letting agencies to fleet and recruitment—Harbor powers branded client portals at scale."
        />
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map(({ title, description }) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.28 }}
              whileHover={{ y: -4 }}
            >
              <GlassPanel
                className={cn(
                  "h-full rounded-2xl p-6 transition-all duration-200",
                  "hover:harbor-glow-ring"
                )}
              >
                <h3 className="text-lg font-semibold text-harbor-navy-deep">
                  {title}
                </h3>
                <p className="mt-3 text-sm text-harbor-text-neutral leading-relaxed">
                  {description}
                </p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
