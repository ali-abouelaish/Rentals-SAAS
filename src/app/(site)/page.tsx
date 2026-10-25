import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@/features/site/styles/home.css";
import { getUserFromAccessTokenCookie } from "@/lib/auth/jwt";
import { resolveWorkspaceUrl } from "@/lib/auth/workspaceUrl";
import { buildPublicApiBaseUrl } from "@/lib/urls";
import { SiteFrame } from "@/features/site/ui/SiteFrame";
import { Closing } from "@/features/site/ui/home/Closing";
import { Story, Services } from "@/features/site/ui/home/Company";
import { Features, Pricing } from "@/features/site/ui/home/Features";
import { Hero } from "@/features/site/ui/home/Hero";
import { HomeMotion } from "@/features/site/ui/home/HomeMotion";
import { HomeNav, type AccountLink } from "@/features/site/ui/home/HomeNav";
import { Away, Rooms, System } from "@/features/site/ui/home/Product";
import { WhyHarbor } from "@/features/site/ui/home/WhyHarbor";

const title = "Harbor — Property management, room by room";
const description =
  "Harbor is property management software for London letting agencies and HMO operators. Every room tracked on its own, from first enquiry to deposit return.";

export const metadata: Metadata = {
  // absolute: the bare domain's title template would otherwise add "· Harbor" again
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Harbor",
    locale: "en_GB",
    url: "/",
    title,
    description,
    images: [
      {
        url: "/site/brand/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "The Harbor logo above two London townhouses, one sage and one cream",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#FDF9F2" };

/**
 * The public website's homepage (the bare domain only: middleware sends an agency subdomain's root
 * to sign-in). Designed as a static site and ported in place; see src/features/site.
 */
export default async function HomePage() {
  const h = headers();
  // Signed in already? Offer the way back in instead of "Sign in". A local decode of the session
  // cookie, never getSession() (which refreshes tokens, and can't save them from here).
  const user = getUserFromAccessTokenCookie();
  const account: AccountLink = user
    ? { href: await resolveWorkspaceUrl({ userId: user.id, host: h.get("host") }), label: "Open workspace" }
    : { href: "/login", label: "Sign in" };

  const siteUrl = buildPublicApiBaseUrl(h);
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Harbor",
    url: `${siteUrl}/`,
    logo: `${siteUrl}/site/brand/apple-touch-icon.png`,
    email: "info@harborops.co.uk",
  };

  return (
    <SiteFrame variant="home">
      <HomeNav account={account} />
      <main id="main" tabIndex={-1}>
        <Hero />
        <WhyHarbor />
        <Rooms />
        <System />
        <Away />
        <Story />
        <Services />
        <Features />
        <Pricing />
      </main>
      <Closing account={account} />
      <HomeMotion />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
    </SiteFrame>
  );
}
