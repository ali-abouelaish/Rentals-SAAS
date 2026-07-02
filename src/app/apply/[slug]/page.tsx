import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Info } from "lucide-react";
import { getPublicBookingForm } from "@/features/booking-forms/data/booking-forms";

// Always fetch the current form — never serve a cached copy.
export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
  searchParams: { unit?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const form = await getPublicBookingForm(params.slug);
  if (!form) return {};

  const brandName = form.tenant?.branding?.brand_name ?? form.tenant?.name ?? "Rental Application";
  return {
    title: `${form.name} — ${brandName}`,
    description: form.description ?? `Apply now via ${brandName}`,
  };
}

export default async function ApplyFallbackPage({ params, searchParams }: PageProps) {
  const form = await getPublicBookingForm(params.slug);
  if (!form) notFound();

  // Preserve the legacy ?unit= query param by redirecting to the new per-room URL.
  if (searchParams.unit) {
    redirect(`/apply/${params.slug}/${searchParams.unit}`);
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center space-y-3">
      <Info className="h-10 w-10 text-amber-600 mx-auto" />
      <h2 className="text-xl font-bold text-amber-900">Room-specific link required</h2>
      <p className="text-sm text-amber-800">
        Applications are accepted per room. Please use the booking link your agent sent you for the specific room you&apos;re interested in.
      </p>
    </div>
  );
}
