import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBookingForm } from "@/features/booking-forms/data/booking-forms";
import { getPublicBankDetails } from "@/features/booking-forms/data/bank-details";
import { getPublicUnitForBooking } from "@/features/booking-forms/data/public-unit";
import { PublicBookingForm } from "../PublicBookingForm";

interface PageProps {
  params: { slug: string; unitId: string };
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

export default async function ApplyForRoomPage({ params }: PageProps) {
  const form = await getPublicBookingForm(params.slug);
  if (!form) notFound();

  const unit = await getPublicUnitForBooking(form.tenant_id, params.unitId);
  if (!unit) notFound();

  const bankDetails = await getPublicBankDetails(form.tenant_id);

  return (
    <PublicBookingForm
      form={form}
      slug={params.slug}
      unit={unit}
      bankDetails={bankDetails}
    />
  );
}
