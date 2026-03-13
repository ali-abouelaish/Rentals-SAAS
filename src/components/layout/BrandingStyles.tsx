import {
  lightenHex,
  darkenHex,
  contrastFgHex,
  hexToRgba,
} from "@/lib/utils/color";
import type { TenantBrandingSettings } from "@/features/admin/domain/types";

const DEFAULT_PRIMARY = "#0B2F59";
const DEFAULT_ACCENT = "#4FD1FF";

function toCssVars(b: TenantBrandingSettings | null): string {
  if (!b?.primary_color) return "";

  const primary = b.primary_color.trim() || DEFAULT_PRIMARY;
  const accent = b.accent_color?.trim() || DEFAULT_ACCENT;

  const primaryFg = contrastFgHex(primary);
  const primaryHover = darkenHex(primary, 0.12);
  const primarySubtle = lightenHex(primary, 0.92);
  const primaryMuted = lightenHex(primary, 0.85);

  const accentFg = contrastFgHex(accent);
  const accentHover = lightenHex(accent, 0.15);
  const accentSubtle = lightenHex(accent, 0.9);
  const accentMuted = lightenHex(accent, 0.8);

  /* Shadows: accent glow for buttons/active states; primary-tinted elevation so depth and hierarchy stay consistent across any brand color */
  const shadowGlow = `0 0 20px ${hexToRgba(accent, 0.22)}`;
  const shadowSm = `0 1px 3px ${hexToRgba(primary, 0.05)}, 0 1px 2px ${hexToRgba(primary, 0.03)}`;
  const shadowMd = `0 4px 6px -1px ${hexToRgba(primary, 0.06)}, 0 2px 4px -2px ${hexToRgba(primary, 0.04)}`;
  const shadowBento = `0 2px 8px ${hexToRgba(primary, 0.05)}, 0 8px 32px ${hexToRgba(primary, 0.07)}`;
  const shadowBentoHover = `0 4px 16px ${hexToRgba(primary, 0.07)}, 0 12px 40px ${hexToRgba(primary, 0.1)}`;
  const shadowCard = `0 1px 4px ${hexToRgba(primary, 0.04)}, 0 6px 20px ${hexToRgba(primary, 0.06)}`;
  const shadowCardHover = `0 8px 25px -5px ${hexToRgba(primary, 0.08)}, 0 4px 10px -3px ${hexToRgba(primary, 0.06)}`;

  /* Surface: very light primary tint for highlight/hover areas so they feel on-brand */
  const surfaceHighlight = lightenHex(primary, 0.965);

  /* Link color matches primary for consistency */
  const textLink = primary;

  return `
  --brand-primary: ${primary};
  --brand-primary-hover: ${primaryHover};
  --brand-primary-fg: ${primaryFg};
  --brand-primary-subtle: ${primarySubtle};
  --brand-primary-muted: ${primaryMuted};
  --brand-accent: ${accent};
  --brand-accent-hover: ${accentHover};
  --brand-accent-fg: ${accentFg};
  --brand-accent-subtle: ${accentSubtle};
  --brand-accent-muted: ${accentMuted};
  --sidebar-bg: ${darkenHex(primary, 0.4)};
  --sidebar-bg-gradient-start: ${primary};
  --sidebar-bg-gradient-end: ${darkenHex(primary, 0.4)};
  --sidebar-glass-bg: ${hexToRgba(primary, 0.88)};
  --sidebar-active-bg: ${accent};
  --sidebar-active-fg: ${accentFg};
  --border-ring: ${accent};
  --shadow-glow: ${shadowGlow};
  --shadow-sm: ${shadowSm};
  --shadow-md: ${shadowMd};
  --shadow-bento: ${shadowBento};
  --shadow-bento-hover: ${shadowBentoHover};
  --shadow-card: ${shadowCard};
  --shadow-card-hover: ${shadowCardHover};
  --surface-highlight: ${surfaceHighlight};
  --text-link: ${textLink};
`.trim();
}

export function BrandingStyles({ branding }: { branding: TenantBrandingSettings | null }) {
  const vars = toCssVars(branding);
  if (!vars) return null;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root { ${vars.replace(/\/\*.*?\*\//g, "").replace(/\n/g, " ") } }`,
      }}
    />
  );
}
