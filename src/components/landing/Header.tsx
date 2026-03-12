"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, Anchor } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";
import { NAV_LINKS } from "@/lib/landing-config";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-white/45 bg-white/65 shadow-[0_10px_30px_rgba(11,47,89,0.1)] backdrop-blur-xl"
          : "bg-transparent"
      )}
      initial={false}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="#"
          className="flex items-center gap-2 text-harbor-navy-deep font-semibold"
          aria-label="Harbor home"
        >
          <span className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-harbor-light-blue to-harbor-navy shadow-md flex items-center justify-center">
            {!logoError ? (
              <Image
                src="/logo.png"
                alt="Harbor"
                fill
                className="object-contain p-0.5"
                sizes="36px"
                unoptimized
                onError={() => setLogoError(true)}
              />
            ) : (
              <Anchor className="h-4 w-4 text-white" aria-hidden />
            )}
          </span>
          <span className="text-xl tracking-tight">Harbor</span>
        </Link>

        <div className="hidden md:flex md:items-center md:gap-8">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="group relative text-sm font-medium text-harbor-text-neutral transition-colors hover:text-harbor-navy"
              onClick={(e) => {
                const el = document.querySelector(href);
                el?.scrollIntoView({ behavior: "smooth" });
                e.preventDefault();
              }}
            >
              {label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-[linear-gradient(90deg,#4FD1FF,#103E73)] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="hidden md:flex md:items-center md:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Book a Demo
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4FD1FF_0%,#103E73_55%,#0B2F59_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(16,62,115,0.35)] transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_38px_rgba(79,209,255,0.35)]"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden rounded-lg border border-harbor-light-blue/35 bg-white/65 p-2 text-harbor-navy backdrop-blur-xl hover:bg-white/85"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="md:hidden border-t border-harbor-light-blue/35 bg-white/80 backdrop-blur-xl"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-harbor-text-neutral hover:bg-harbor-light-blue/10 hover:text-harbor-navy"
                  onClick={() => {
                    setMobileOpen(false);
                    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    setMobileOpen(false);
                    document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Book a Demo
                </Button>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4FD1FF_0%,#103E73_55%,#0B2F59_100%)] px-6 py-3 text-base font-semibold text-white shadow-[0_14px_34px_rgba(16,62,115,0.35)] transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_38px_rgba(79,209,255,0.35)]"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
