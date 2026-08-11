import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { BrandingStyles } from "@/components/layout/BrandingStyles";
import { getPortalBrandChrome } from "@/features/portal/data/branding";

export const dynamic = "force-dynamic";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export async function generateViewport(): Promise<Viewport> {
  const { themeColor } = await getPortalBrandChrome();
  return {
    width: "device-width",
    initialScale: 1,
    // Lets the sticky mobile action bar pad itself past the home indicator and
    // the page paint edge-to-edge on notched devices — without this,
    // env(safe-area-inset-*) resolves to 0.
    viewportFit: "cover",
    themeColor,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { brandName, logoUrl } = await getPortalBrandChrome();
  // iOS ignores manifest icons for "Add to Home Screen"; the apple-touch-icon
  // is what it actually uses, so point both at the agency logo when there is one.
  const icon = logoUrl ?? "/logo.png";

  return {
    title: "Tenant portal",
    manifest: "/portal/manifest.webmanifest",
    icons: { icon, apple: icon },
    appleWebApp: {
      capable: true,
      title: brandName,
      // "default" keeps the status bar opaque and light, matching the portal's
      // light surface directly beneath it.
      statusBarStyle: "default",
    },
  };
}

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { brandName, logoUrl, branding } = await getPortalBrandChrome();

  return (
    <div
      className={`${fraunces.variable} relative min-h-screen overflow-hidden bg-surface-ground text-foreground`}
      // viewport-fit=cover paints under the notch; in landscape that would slide
      // the cards beneath it, so keep the content inside the safe area.
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <BrandingStyles branding={branding} />

      {/* atmosphere — layered radial washes in the tenant brand */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 40% at 15% -10%, color-mix(in oklab, var(--brand-accent) 20%, transparent), transparent 62%)",
            "radial-gradient(ellipse 60% 45% at 110% 15%, color-mix(in oklab, var(--brand-primary) 12%, transparent), transparent 62%)",
            "radial-gradient(ellipse 90% 50% at 50% 120%, color-mix(in oklab, var(--brand-accent) 14%, transparent), transparent 72%)",
          ].join(", "),
        }}
      />
      {/* fine-grain texture overlay for warmth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-8 pb-5 sm:px-6 sm:pt-10">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-card shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_8px_20px_-10px_rgba(15,23,42,0.25)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={brandName}
                  className="h-full w-full object-contain p-1"
                />
              </span>
            ) : (
              <span
                aria-hidden
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-card shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_8px_20px_-10px_rgba(15,23,42,0.25)]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: "var(--brand-primary)" }}
                />
              </span>
            )}
            <div className="flex flex-col">
              <span
                className="text-[1.4rem] leading-none tracking-[-0.012em] text-foreground"
                style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 500 }}
              >
                {brandName}
              </span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground-muted">
                Tenant portal
              </span>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div
            aria-hidden
            className="h-px w-full"
            style={{
              background:
                "linear-gradient(to right, transparent, color-mix(in oklab, var(--border-default) 80%, transparent) 30%, color-mix(in oklab, var(--border-default) 80%, transparent) 70%, transparent)",
            }}
          />
        </div>
      </header>

      <main className="relative z-10">{children}</main>

      {/* Bottom padding reserves the strip the fixed mobile action bar covers,
          so the last thing on the page is never trapped underneath it. */}
      <footer className="relative z-10 mx-auto max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)_+_5rem)] pt-6 sm:px-6 md:pb-10">
        <p className="text-center text-[11px] tracking-[0.05em] text-foreground-muted">
          Your tenant portal, provided by {brandName}
        </p>
      </footer>
    </div>
  );
}
