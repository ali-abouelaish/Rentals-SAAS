"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SUBDOMAIN_EXAMPLES } from "@/lib/landing-config";
import { cn } from "@/lib/utils/cn";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-16 sm:pt-32 sm:pb-24 harbor-divider">
      <div className="absolute inset-0 harbor-futuristic-bg" />
      <div className="harbor-grid-overlay absolute inset-0 opacity-40" />
      <motion.div
        className="pointer-events-none absolute top-16 right-[-6%] h-[420px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(79,209,255,0.3),rgba(16,62,115,0.02)_70%)] blur-2xl"
        animate={{ y: [-6, 12, -6], x: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-8 left-[-8%] h-[340px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(16,62,115,0.22),rgba(79,209,255,0.03)_72%)] blur-2xl"
        animate={{ y: [8, -8, 8], x: [0, 8, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-harbor-light-blue/45 bg-white/55 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-harbor-navy backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4FD1FF] shadow-[0_0_16px_rgba(79,209,255,0.8)]" />
              Harbor OS
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-harbor-navy-deep sm:text-5xl lg:text-6xl font-heading">
              Launch branded client portals on your own subdomains.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-harbor-text-neutral">
              Harbor gives you one platform to create clean, branded portals for every client—each on its own subdomain. Centralized control, white-label experience, built to scale.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="#contact"
                className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4FD1FF_0%,#103E73_55%,#0B2F59_100%)] px-8 py-4 text-lg font-semibold text-white shadow-[0_18px_38px_rgba(16,62,115,0.35)] transition-all duration-200 hover:scale-[1.01] hover:brightness-110 hover:shadow-[0_0_42px_rgba(79,209,255,0.35)]"
              >
                Book a Demo
              </a>
              <Link
                href="/dashboard"
                className={cn(
                  "inline-flex items-center justify-center rounded-xl border border-harbor-light-blue/60 bg-white/55 px-8 py-4 text-lg font-semibold text-harbor-navy backdrop-blur-xl transition-all duration-200",
                  "hover:scale-[1.01] hover:bg-white/75 hover:shadow-[0_0_30px_rgba(79,209,255,0.2)]"
                )}
              >
                View Platform
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: "easeOut" }}
          >
            <div className="pointer-events-none absolute -inset-5 rounded-3xl bg-[radial-gradient(circle,rgba(79,209,255,0.3),rgba(16,62,115,0.12)_55%,rgba(11,47,89,0.03)_75%)] blur-2xl" />
            <div className="relative glass-panel-strong rounded-2xl p-6 sm:p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-harbor-text-neutral/95">
                  <span className="h-2 w-2 rounded-full bg-[#4FD1FF] shadow-[0_0_14px_rgba(79,209,255,0.85)]" />
                  Live portals
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {["Dashboard", "Clients", "Activity", "Settings"].map((label) => (
                    <motion.div
                      key={label}
                      className="rounded-xl border border-harbor-light-blue/30 bg-white/55 p-4 backdrop-blur-xl"
                      whileHover={{ y: -3 }}
                    >
                      <p className="text-sm font-medium text-harbor-navy">{label}</p>
                      <p className="mt-1 text-xs text-harbor-text-neutral">Overview</p>
                    </motion.div>
                  ))}
                </div>
                <motion.div
                  className="rounded-xl border border-harbor-light-blue/35 bg-white/60 p-4 backdrop-blur-xl"
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <p className="text-xs font-medium text-harbor-text-neutral mb-2">
                    Client subdomains
                  </p>
                  <ul className="space-y-1.5">
                    {SUBDOMAIN_EXAMPLES.map((sub) => (
                      <li
                        key={sub}
                        className="text-sm text-harbor-navy font-mono truncate"
                      >
                        {sub}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
