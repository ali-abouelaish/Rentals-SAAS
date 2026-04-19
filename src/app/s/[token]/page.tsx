import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

  return (
    <div className="min-h-screen bg-surface-page">
      <ViewTracker token={share.token} />
      <header className="border-b border-border bg-surface-card">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-semibold text-foreground">{share.name}</h1>
          {share.description && (
            <p className="mt-1 text-muted-foreground">{share.description}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {units.length} unit{units.length === 1 ? "" : "s"} available
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <ShareBody
          units={units}
          commissionPct={share.commission_override_pct}
          token={share.token}
        />
      </main>
    </div>
  );
}
