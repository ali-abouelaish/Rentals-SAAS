import { SectionHeading } from "./SectionHeading";
import { PRICING_TIERS } from "@/lib/landing-config";
import { PricingCard } from "./PricingCard";

export function Pricing() {
  return (
    <section id="pricing" className="relative py-20 sm:py-28 harbor-divider">
      <div className="absolute inset-0 harbor-futuristic-bg" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Flexible Plans"
          title="Simple, scalable pricing"
          subtitle="Choose the plan that fits your operations. Custom options available for high-volume use."
        />
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {PRICING_TIERS.map((tier, index) => (
            <PricingCard
              key={tier.name}
              name={tier.name}
              description={tier.description}
              price={tier.price}
              features={tier.features}
              cta={tier.cta}
              highlighted={tier.highlighted}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
