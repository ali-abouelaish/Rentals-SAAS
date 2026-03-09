"use client";

import { SectionHeading } from "./SectionHeading";
import {
  Users,
  Layout,
  Activity,
  BarChart3,
  FileText,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { GlassPanel } from "./GlassPanel";

const PREVIEW_ITEMS = [
  {
    title: "Tenant switcher",
    description: "Switch between client workspaces instantly.",
    icon: Users,
  },
  {
    title: "Client portal",
    description: "Branded portal per client on its own subdomain.",
    icon: Layout,
  },
  {
    title: "Activity feed",
    description: "Tasks, updates, and status across all tenants.",
    icon: Activity,
  },
  {
    title: "Analytics summary",
    description: "Operational visibility and key metrics.",
    icon: BarChart3,
  },
  {
    title: "Document access",
    description: "Secure storage and sharing per workspace.",
    icon: FileText,
  },
  {
    title: "Permissions & users",
    description: "Role-based access and user management.",
    icon: Shield,
  },
];

export function ProductPreview() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#edf5ff_0%,#f8fbff_45%,#f3f8ff_100%)]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Platform Control Center"
          title="One platform, full control"
          subtitle="Central dashboard to manage tenants, portals, and operations—with subdomain-based access for every client."
        />
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEW_ITEMS.map(({ title, description, icon: Icon }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 0.32, delay: index * 0.04 }}
              whileHover={{ y: -5 }}
            >
              <GlassPanel
                className={cn(
                  "h-full rounded-2xl p-6 transition-all duration-200",
                  "hover:harbor-glow-ring"
                )}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-harbor-light-blue/35 bg-white/65 text-harbor-navy shadow-[0_0_24px_rgba(79,209,255,0.2)]">
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
          ))}
        </div>
        <motion.div
          className="mt-12 rounded-2xl"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <GlassPanel strong className="rounded-2xl p-6 sm:p-8">
            <p className="text-center text-sm font-medium text-harbor-text-neutral">
              Example subdomains:{" "}
              <span className="font-mono text-harbor-navy shadow-[0_0_20px_rgba(79,209,255,0.3)]">
                agency.harborops.co.uk
              </span>
              ,{" "}
              <span className="font-mono text-harbor-navy shadow-[0_0_20px_rgba(79,209,255,0.3)]">
                truehold.harborops.co.uk
              </span>
              ,{" "}
              <span className="font-mono text-harbor-navy shadow-[0_0_20px_rgba(79,209,255,0.3)]">
                client.harborops.co.uk
              </span>
              .
            </p>
          </GlassPanel>
        </motion.div>
      </div>
    </section>
  );
}
