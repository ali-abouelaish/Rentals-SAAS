import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBookingForm } from "@/features/booking-forms/data/booking-forms";
import { PublicBookingForm } from "./PublicBookingForm";

interface PageProps {
  params: { slug: string };
  searchParams: { unit?: string };
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

export default async function ApplyPage({ params, searchParams }: PageProps) {
  const form = await getPublicBookingForm(params.slug);
  if (!form) notFound();

  return (
    <PublicBookingForm
      form={form}
      slug={params.slug}
      preselectedUnitId={searchParams.unit}
    />
  );
}
