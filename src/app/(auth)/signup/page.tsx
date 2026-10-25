import type { Metadata } from "next";
import { getDoorContext } from "@/features/auth/data/door";
import { DoorShell } from "@/features/auth/ui/door/DoorShell";
import { DemoRequestForm } from "@/features/demo-requests/ui/DemoRequestForm";

export const dynamic = "force-dynamic";

const description =
  "Tell us about your portfolio and book a walkthrough of Harbor, room-by-room property management for London letting agencies and HMO operators.";

// The demo request is a page people should find, unlike the rest of the front door.
export const metadata: Metadata = {
  title: "Request a demo",
  description,
  robots: { index: true, follow: true },
  alternates: { canonical: "/signup" },
  openGraph: {
    type: "website",
    siteName: "Harbor",
    locale: "en_GB",
    url: "/signup",
    title: "Request a demo · Harbor",
    description: "Bring your portfolio. Leave your spreadsheets. A person reads every request and replies within 48 hours.",
    images: [{ url: "/site/brand/og-image.jpg", width: 1200, height: 630, alt: "The Harbor logo above two London townhouses, one sage and one cream" }],
  },
  twitter: { card: "summary_large_image" },
};

/** "Request a demo" (and the Enterprise card's "Request a quote", ?plan=enterprise). */
export default async function SignupPage({ searchParams }: { searchParams?: { plan?: string } }) {
  const { siteHref } = await getDoorContext();
  const plan = searchParams?.plan === "enterprise" ? "enterprise" : null;

  return (
    <DoorShell card switchLink={{ lead: "Already a customer?", label: "Sign in", href: "/login" }}>
      <DemoRequestForm plan={plan} siteHref={siteHref} />
    </DoorShell>
  );
}
