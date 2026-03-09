import Link from "next/link";
import Image from "next/image";
import { NAV_LINKS } from "@/lib/landing-config";

export function Footer() {
  return (
    <footer className="relative border-t border-harbor-light-blue/30 bg-white/75 py-12 backdrop-blur-xl sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="#"
              className="flex items-center gap-2 text-harbor-navy-deep font-semibold"
              aria-label="Harbor home"
            >
              <span className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-harbor-light-blue to-harbor-navy shadow-sm">
                <Image
                  src="/harbor-logo.png"
                  alt=""
                  fill
                  className="object-contain p-0.5"
                  sizes="32px"
                  unoptimized
                />
              </span>
              <span className="text-lg">Harbor</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-harbor-text-neutral leading-relaxed">
              The operating system for client portals and multi-tenant operations. Branded subdomains, centralized control, built to scale.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-harbor-navy-deep">Product</h4>
            <ul className="mt-4 space-y-3">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-sm text-harbor-text-neutral transition-colors hover:text-harbor-navy"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-harbor-navy-deep">Contact</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href="mailto:hello@harborops.co.uk"
                  className="text-sm text-harbor-text-neutral transition-colors hover:text-harbor-navy"
                >
                  hello@harborops.co.uk
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-harbor-light-blue/25 pt-8 text-center text-sm text-harbor-text-neutral">
          <p>© {new Date().getFullYear()} Harbor. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
