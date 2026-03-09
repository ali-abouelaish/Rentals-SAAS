import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { Features } from "@/components/landing/Features";
import { Solutions } from "@/components/landing/Solutions";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { Pricing } from "@/components/landing/Pricing";
import { ContactCta } from "@/components/landing/ContactCta";
import { Footer } from "@/components/landing/Footer";

export const metadata = {
  title: "Harbor — Client Portals on Your Subdomains",
  description:
    "Launch branded client portals on your own subdomains. Centralized operations, white-label experience, built to scale. The operating system for multi-tenant operations.",
  openGraph: {
    title: "Harbor — Client Portals on Your Subdomains",
    description:
      "Launch branded client portals on your own subdomains. Centralized operations, white-label experience, built to scale.",
  },
};

export default function LandingPage() {
  return (
    <div className="harbor-futuristic-bg min-h-screen scroll-smooth">
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <Features />
        <Solutions />
        <HowItWorks />
        <ProductPreview />
        <Pricing />
        <ContactCta />
        <Footer />
      </main>
    </div>
  );
}
