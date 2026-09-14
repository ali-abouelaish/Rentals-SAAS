import { cn } from "@/lib/utils/cn";
import type { Integration } from "@/lib/integrations/catalog";

/**
 * The provider's mark on an integration card.
 *
 * Renders the real brand asset when the catalogue names one, and a monogram
 * tile in the provider's brand colour when it doesn't. The fallback is the
 * normal case today — the repo carries no third-party brand assets, and a
 * redrawn approximation of someone else's logo is worse than an honest
 * monogram.
 *
 * The tile paints its own background and white text rather than using theme
 * tokens, so it looks the same in light and dark. That is the point of a brand
 * colour: it does not follow the surrounding UI.
 */
export function IntegrationLogo({
  integration,
  className,
}: {
  integration: Integration;
  className?: string;
}) {
  const { logo, provider } = integration;

  if (logo.src) {
    return (
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white",
          className
        )}
      >
        {/* Plain img, not next/image: these are small static marks whose
            dimensions we don't control, and the optimiser would add a remote
            fetch round trip for no gain. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo.src}
          alt={`${provider} logo`}
          className="h-7 w-7 object-contain"
          loading="lazy"
        />
      </span>
    );
  }

  // Three characters need to be smaller to fit the same tile as one or two.
  const isLong = logo.monogram.length >= 3;

  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-semibold tracking-tight text-white",
        isLong ? "text-[11px]" : "text-sm",
        className
      )}
      style={{ backgroundColor: logo.brandColor }}
      // The provider name is already rendered as text beside this, so the tile
      // is decorative — announcing it again would just be noise in a screen
      // reader.
      aria-hidden
    >
      {logo.monogram}
    </span>
  );
}
