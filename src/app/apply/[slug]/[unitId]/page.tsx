import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBookingForm } from "@/features/booking-forms/data/booking-forms";
import { getPublicBankDetailsForForm } from "@/features/booking-forms/data/bank-details";
import { getPublicUnitForBooking } from "@/features/booking-forms/data/public-unit";
import { PublicBookingForm } from "../PublicBookingForm";

interface PageProps {
  params: { slug: string; unitId: string };
  searchParams: { price?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const form = await getPublicBookingForm(params.slug);
  if (!form) return {};

  const brandName = form.tenant?.branding?.brand_name ?? form.tenant?.name ?? "Rental Application";
  const title = `${form.name} — ${brandName}`;
  const description = form.description ?? `Apply now via ${brandName}`;
  const logoUrl = form.tenant?.branding?.logo_url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(logoUrl ? { images: [{ url: logoUrl }] } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(logoUrl ? { images: [logoUrl] } : {}),
    },
  };
}

export default async function ApplyForRoomPage({ params, searchParams }: PageProps) {
  const form = await getPublicBookingForm(params.slug);
  if (!form) notFound();

  const unit = await getPublicUnitForBooking(form.tenant_id, params.unitId);
  if (!unit) notFound();

  const bankDetails = await getPublicBankDetailsForForm(form.id);

  const parsedPrice = searchParams.price ? Number(searchParams.price) : NaN;
  const agreedPrice =
    Number.isFinite(parsedPrice) &&
    parsedPrice > 0 &&
    (unit.min_price_pcm === null || parsedPrice >= unit.min_price_pcm) &&
    (unit.max_price_pcm === null || parsedPrice <= unit.max_price_pcm)
      ? Math.round(parsedPrice)
      : null;

  return (
    <PublicBookingForm
      form={form}
      slug={params.slug}
      unit={unit}
      bankDetails={bankDetails}
      agreedPrice={agreedPrice}
    />
  );
}
