"use client";

import { Button } from "./Button";
import { Mail, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { GlassPanel } from "./GlassPanel";

export function ContactCta() {
  return (
    <section id="contact" className="relative py-20 sm:py-28">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#edf4ff_0%,#f7fbff_100%)]" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          className="text-3xl font-bold tracking-tight text-harbor-navy-deep sm:text-4xl font-heading"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.3 }}
        >
          Ready to launch your client portals with Harbor?
        </motion.h2>
        <p className="mt-4 text-lg text-harbor-text-neutral/95">
          Book a demo or get in touch. We’ll show you how to run branded subdomains and centralized operations at scale.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={() =>
              window.location.assign("mailto:hello@harborops.co.uk?subject=Harbor%20demo%20request")
            }
          >
            <Mail className="h-5 w-5 mr-2" aria-hidden />
            Book a Demo
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              window.location.assign("mailto:hello@harborops.co.uk?subject=Harbor%20contact")
            }
          >
            <MessageSquare className="h-5 w-5 mr-2" aria-hidden />
            Contact Sales
          </Button>
        </div>
        <GlassPanel strong className="mt-12 rounded-2xl p-6 text-left">
          <p className="text-sm font-medium text-harbor-text-neutral mb-2">
            Or send us a message
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Name"
                className="w-full rounded-lg border border-harbor-light-blue/45 bg-white/70 px-4 py-3 text-sm text-harbor-navy-deep placeholder:text-harbor-text-neutral focus:outline-none focus:ring-2 focus:ring-harbor-light-blue/35 focus:border-harbor-navy"
                aria-label="Your name"
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full rounded-lg border border-harbor-light-blue/45 bg-white/70 px-4 py-3 text-sm text-harbor-navy-deep placeholder:text-harbor-text-neutral focus:outline-none focus:ring-2 focus:ring-harbor-light-blue/35 focus:border-harbor-navy"
                aria-label="Email address"
              />
            </div>
            <textarea
              placeholder="Tell us about your use case..."
              rows={4}
              className="w-full resize-none rounded-lg border border-harbor-light-blue/45 bg-white/70 px-4 py-3 text-sm text-harbor-navy-deep placeholder:text-harbor-text-neutral focus:outline-none focus:ring-2 focus:ring-harbor-light-blue/35 focus:border-harbor-navy"
              aria-label="Message"
            />
            <Button type="submit" variant="primary" size="md" className="w-full sm:w-auto">
              Send message
            </Button>
          </form>
        </GlassPanel>
      </div>
    </section>
  );
}
