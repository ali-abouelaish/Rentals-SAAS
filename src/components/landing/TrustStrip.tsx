"use client";

import { TRUST_STRIP } from "@/lib/landing-config";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

export function TrustStrip() {
  return (
    <section className="relative border-y border-harbor-light-blue/25 bg-white/55 py-8 backdrop-blur-xl harbor-divider">
      <div className="harbor-grid-overlay absolute inset-0 opacity-30" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {TRUST_STRIP.map((item, index) => (
            <motion.div
              key={item}
              className="flex items-center gap-3 text-harbor-navy-deep"
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-harbor-light-blue/45 bg-white/70 text-harbor-navy shadow-[0_0_22px_rgba(79,209,255,0.25)]">
                <Check className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm font-medium sm:text-base">{item}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
