import type { Metadata, MetadataRoute } from "next";

/**
 * Harbor's own icons (public/site/brand). The bare domain uses them, and so does an agency
 * subdomain until the agency uploads a logo of its own.
 */
export const HARBOR_ICONS: NonNullable<Metadata["icons"]> = {
  icon: [
    { url: "/site/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
    { url: "/site/brand/harbor-emblem-teal.svg", type: "image/svg+xml" },
  ],
  apple: "/site/brand/apple-touch-icon.png",
};

/**
 * The same icons for a web app manifest, with their sizes declared honestly: Chrome's install
 * check wants a PNG, SVG or WebP icon of at least 144px whose size it can read.
 */
export const HARBOR_MANIFEST_ICONS: NonNullable<MetadataRoute.Manifest["icons"]> = [
  { src: "/site/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  { src: "/site/brand/harbor-emblem-teal.svg", sizes: "any", type: "image/svg+xml" },
];
