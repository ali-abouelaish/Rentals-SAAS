import "./globals.css";
import { Inter, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ClientToaster } from "@/components/shared/ClientToaster";
import { getTenantBrandingByHost } from "@/lib/tenant";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"]
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["600"]
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getTenantBrandingByHost();

  if (!branding) {
    return {
      title: "Rental Agency SaaS",
      description: "Multi-tenant rental agency platform",
      icons: { icon: "/logo.png", apple: "/logo.png" },
    };
  }

  const title = branding.brandName;
  const description = `${branding.brandName} — property management portal`;
  const images = branding.logoUrl ? [{ url: branding.logoUrl }] : undefined;
  const icon = branding.logoUrl ?? "/logo.png";

  return {
    title: {
      default: title,
      template: `%s — ${title}`,
    },
    description,
    icons: { icon, apple: icon },
    openGraph: {
      title,
      description,
      siteName: title,
      type: "website",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: branding.logoUrl ? "summary" : "summary_large_image",
      title,
      description,
      ...(branding.logoUrl ? { images: [branding.logoUrl] } : {}),
    },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <ClientToaster />
      </body>
    </html>
  );
}
