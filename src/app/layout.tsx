import "./globals.css";
import { Inter, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ClientToaster } from "@/components/shared/ClientToaster";
import { HARBOR_ICONS } from "@/features/site/brand";
import { getTenantBrandingByHost } from "@/lib/tenant";
import { buildPublicApiBaseUrl, buildTenantAppUrl } from "@/lib/urls";

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

/**
 * `viewportFit: "cover"` is the part that matters.
 *
 * Next's default viewport tag omits it, which makes every `env(safe-area-inset-*)`
 * resolve to 0 on iOS — so the mobile bottom nav, which pads itself with
 * `env(safe-area-inset-bottom)`, sat underneath the home indicator on every
 * iPhone. `maximumScale` is deliberately absent: capping zoom is an
 * accessibility failure, and the layout should not need it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** An absolute base for metadata URLs, or none rather than a crash if the request has no usable host. */
function metadataBaseFrom(origin: string): URL | undefined {
  try {
    return new URL(origin);
  } catch {
    return undefined;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getTenantBrandingByHost();

  if (!branding) {
    // The bare domain: the public website, and sign-in for anyone not on their agency's subdomain.
    // metadataBase resolves the pages' relative canonical and share-image URLs (on the bare domain
    // in production; never NEXT_PUBLIC_APP_URL, which is frozen at build time).
    return {
      metadataBase: metadataBaseFrom(buildPublicApiBaseUrl(headers())),
      title: { default: "Harbor", template: "%s · Harbor" },
      description:
        "Property management software for London letting agencies and HMO operators. Every room tracked on its own, from first enquiry to deposit return.",
      icons: HARBOR_ICONS,
    };
  }

  const title = branding.brandName;
  const description = `${branding.brandName} — property management portal`;
  const images = branding.logoUrl ? [{ url: branding.logoUrl }] : undefined;

  return {
    metadataBase: metadataBaseFrom(buildTenantAppUrl(headers())),
    title: {
      default: title,
      template: `%s — ${title}`,
    },
    description,
    icons: branding.logoUrl ? { icon: branding.logoUrl, apple: branding.logoUrl } : HARBOR_ICONS,
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
