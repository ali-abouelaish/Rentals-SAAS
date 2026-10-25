import type { CSSProperties, ReactNode } from "react";

/** The site's arrow, as on every pill button. */
export function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** The design's pill link: dark by default; `tone` picks the light or outlined versions. */
export function Pill({
  href,
  children,
  tone,
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: "light" | "line";
  className?: string;
}) {
  const classes = ["pill", tone ? `pill--${tone}` : null, className].filter(Boolean).join(" ");
  return (
    <a className={classes} href={href}>
      {children}
      <Arrow />
    </a>
  );
}

/** Inline custom properties, e.g. style={cssVars({ "--x": 0.14, "--n": 3 })}. */
export function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
  return vars as CSSProperties;
}
