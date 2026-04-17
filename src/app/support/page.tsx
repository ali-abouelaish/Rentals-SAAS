import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { resolveSupportTenantFromServer } from "@/features/support/data/resolveTenant";
import { getSupportBootstrap } from "@/features/support/data/queries";
import { SupportExperience } from "@/features/support/ui/SupportExperience";

export const dynamic = "force-dynamic";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

interface PageProps {
  searchParams: { companySlug?: string };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const tenant = await resolveSupportTenantFromServer(searchParams.companySlug);
  if (!tenant) return { title: "Support" };
  return { title: `Support — ${tenant.name}` };
}

export default async function SupportPage({ searchParams }: PageProps) {
  const tenant = await resolveSupportTenantFromServer(searchParams.companySlug);
  if (!tenant) notFound();

  const { properties } = await getSupportBootstrap(tenant.id);

  return (
    <div
      className={`${fraunces.variable} relative min-h-screen overflow-hidden bg-surface-ground text-foreground`}
    >
      {/* atmosphere — soft radial washes in the tenant brand, layered behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 40% at 15% -10%, color-mix(in oklab, var(--brand-accent) 18%, transparent), transparent 60%)",
            "radial-gradient(ellipse 60% 45% at 110% 20%, color-mix(in oklab, var(--brand-primary) 10%, transparent), transparent 60%)",
            "radial-gradient(ellipse 90% 50% at 50% 120%, color-mix(in oklab, var(--brand-accent) 12%, transparent), transparent 70%)",
          ].join(", "),
        }}
      />
      {/* fine-grain texture overlay for warmth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-card shadow-sm"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--brand-primary)" }}
              />
            </span>
            <span
              className="text-[1.35rem] leading-none tracking-[-0.01em] text-foreground"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 500 }}
            >
              {tenant.name}
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-muted">
            Concierge
          </span>
        </div>
      </header>

      <main className="relative mx-auto max-w-2xl px-6 pt-6 pb-8">
        <SupportExperience
          company={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
          properties={properties}
          companySlugParam={searchParams.companySlug ?? null}
        />
      </main>

      <footer className="relative z-10 mx-auto max-w-2xl px-6 pb-8">
        <p className="text-center text-[11px] tracking-wide text-foreground-muted">
          Calm, thoughtful help — usually within the same day.
        </p>
      </footer>
    </div>
  );
}
