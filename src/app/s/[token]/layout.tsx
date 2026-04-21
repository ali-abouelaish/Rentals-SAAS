import type { ReactNode } from "react";
import { Fraunces } from "next/font/google";
import { BrandingStyles } from "@/components/layout/BrandingStyles";
import { getPublicShareBrandContext } from "@/features/property-shares/data/public";

interface LayoutProps {
  children: ReactNode;
  params: { token: string };
}

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export default async function PublicShareLayout({ children, params }: LayoutProps) {
  const brand = await getPublicShareBrandContext(params.token);

  const brandName = brand?.brand_name ?? "Property selection";
  const logoUrl = brand?.logo_url ?? null;

  const brandingForVars = brand
    ? {
        tenant_id: "",
        brand_name: brand.brand_name,
        logo_url: brand.logo_url,
        primary_color: brand.primary_color,
        secondary_color: brand.secondary_color,
        accent_color: brand.accent_color,
        theme_mode: "light" as const,
        font_family: null,
        updated_at: "",
      }
    : null;

  return (
    <div
      className={`${fraunces.variable} relative min-h-screen overflow-hidden bg-surface-ground text-foreground`}
    >
      <BrandingStyles branding={brandingForVars} />

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
      {/* hairline grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-8 pb-5 sm:px-6 sm:pt-10">
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
                <span
                  aria-hidden
                  className="absolute inset-0 animate-ping rounded-full opacity-20"
                  style={{ background: "var(--brand-primary)", animationDuration: "3.5s" }}
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
                Property selection
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_color-mix(in_oklab,#10b981_18%,transparent)]"
            />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-muted">
              Live listing
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
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

      <footer className="relative z-10 mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="flex items-center justify-center gap-3">
          <span
            aria-hidden
            className="h-px w-8"
            style={{ background: "color-mix(in oklab, var(--border-default) 80%, transparent)" }}
          />
          <p className="text-center text-[11px] tracking-[0.05em] text-foreground-muted">
            Curated by {brandName}
          </p>
          <span
            aria-hidden
            className="h-px w-8"
            style={{ background: "color-mix(in oklab, var(--border-default) 80%, transparent)" }}
          />
        </div>
      </footer>
    </div>
  );
}
