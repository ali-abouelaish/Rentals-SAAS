import type { ReactNode } from "react";
import { Fraunces } from "next/font/google";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface LayoutProps {
  children: ReactNode;
  params: { slug: string };
}

type TenantRow = {
  name: string;
  branding: { brand_name: string | null } | null;
} | null;

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export default async function ApplyLayout({ children, params }: LayoutProps) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("booking_forms")
    .select("tenant:tenants(name, branding:tenant_branding_settings(brand_name))")
    .eq("public_slug", params.slug)
    .eq("is_active", true)
    .single();

  const tenant = data?.tenant as unknown as TenantRow;
  const brandName = tenant?.branding?.brand_name ?? tenant?.name ?? "Rental Application";

  return (
    <div
      className={`${fraunces.variable} relative min-h-screen overflow-hidden bg-surface-ground text-foreground`}
    >
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
      {/* hairline grid, barely there — adds structure without noise */}
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
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 pt-9 pb-5">
          <div className="flex items-center gap-3">
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
            <div className="flex flex-col">
              <span
                className="text-[1.4rem] leading-none tracking-[-0.012em] text-foreground"
                style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 500 }}
              >
                {brandName}
              </span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground-muted">
                Rental application
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_color-mix(in_oklab,#10b981_18%,transparent)]"
            />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-muted">
              Accepting
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-6">
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

      <main className="relative mx-auto max-w-2xl px-6 pt-8 pb-10">
        {children}
      </main>

      <footer className="relative z-10 mx-auto max-w-2xl px-6 pb-10">
        <div className="flex items-center justify-center gap-3">
          <span
            aria-hidden
            className="h-px w-8"
            style={{ background: "color-mix(in oklab, var(--border-default) 80%, transparent)" }}
          />
          <p className="text-center text-[11px] tracking-[0.05em] text-foreground-muted">
            We review every application carefully — usually within one working day
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
