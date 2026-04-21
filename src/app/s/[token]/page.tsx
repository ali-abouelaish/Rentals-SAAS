import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, Sparkles } from "lucide-react";
import { getPublicShareByToken, getPublicShareUnits } from "@/features/property-shares/data/public";
import { deriveShareStatus } from "@/features/property-shares/domain/types";
import { ShareBody } from "@/features/property-shares/ui/ShareBody";
import { LinkInactive } from "@/features/property-shares/ui/LinkInactive";
import { ViewTracker } from "@/features/property-shares/ui/ViewTracker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { token: string };
}

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const share = await getPublicShareByToken(params.token);
  if (!share) return { robots: { index: false, follow: false } };

  const status = deriveShareStatus(share);
  if (status !== "active") {
    return {
      title: share.name,
      robots: { index: false, follow: false },
    };
  }

  const units = await getPublicShareUnits(share);
  const heroImage = units.find((u) => u.photos.length > 0)?.photos[0]?.url;
  const description = `${units.length} unit${units.length === 1 ? "" : "s"} available`;

  return {
    title: share.name,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: share.name,
      description,
      ...(heroImage ? { images: [{ url: heroImage }] } : {}),
    },
    twitter: {
      card: heroImage ? "summary_large_image" : "summary",
      title: share.name,
      description,
      ...(heroImage ? { images: [heroImage] } : {}),
    },
  };
}

export default async function PublicSharePage({ params }: PageProps) {
  const share = await getPublicShareByToken(params.token);
  if (!share) notFound();

  const status = deriveShareStatus(share);
  if (status === "revoked") return <LinkInactive reason="revoked" />;
  if (status === "expired") return <LinkInactive reason="expired" />;

  const units = await getPublicShareUnits(share);
  const unitsLabel = `${units.length} unit${units.length === 1 ? "" : "s"} available`;

  return (
    <div className="min-h-screen bg-surface-page">
      <ViewTracker token={share.token} />

      <header className="mx-auto max-w-6xl px-4 pt-10 pb-6 sm:pt-14">
        <section
          className="relative overflow-hidden rounded-3xl border border-border bg-surface-card p-7 shadow-sm sm:p-9"
          style={{
            backgroundImage:
              "radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--brand-primary) 12%, transparent), transparent 55%)",
          }}
        >
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-subtle text-brand sm:h-14 sm:w-14">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-secondary backdrop-blur">
                <Sparkles className="h-3 w-3 text-brand" />
                Curated selection
              </div>
              <h1
                className="text-[2rem] leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[2.4rem]"
                style={{ ...SERIF, fontWeight: 500 }}
              >
                {share.name}
              </h1>
              {share.description && (
                <p className="mt-3 max-w-2xl text-sm text-foreground-secondary sm:text-[15px]">
                  {share.description}
                </p>
              )}
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-surface-inset/60 px-3 py-1.5 text-xs font-medium text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {unitsLabel}
              </div>
            </div>
          </div>
        </section>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-14">
        <ShareBody
          units={units}
          commissionPct={share.commission_override_pct}
          token={share.token}
        />
      </main>
    </div>
  );
}
