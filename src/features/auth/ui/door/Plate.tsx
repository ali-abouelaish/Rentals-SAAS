import type { ReactNode } from "react";

/**
 * The enamel sign screwed to the door: the sign-in screens' card. `brandLine` names the agency on
 * its own subdomain ("Sign in to Acme Lettings"), under the Harbor mark.
 */
export function Plate({
  title,
  sub,
  brandLine,
  children,
  as: Tag = "main",
  className,
  id = "main",
}: {
  title: ReactNode;
  sub?: ReactNode;
  brandLine?: string | null;
  children?: ReactNode;
  as?: "main" | "section";
  className?: string;
  id?: string;
}) {
  return (
    <Tag className={className ? `plate rise ${className}` : "plate rise"} style={{ "--d": 1 } as React.CSSProperties} id={id}>
      <span className="screw screw--tl" aria-hidden="true" />
      <span className="screw screw--tr" aria-hidden="true" />
      <span className="screw screw--bl" aria-hidden="true" />
      <span className="screw screw--br" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="plate__mark" src="/site/brand/harbor-logo-teal.svg" alt="Harbor" width={118} height={29} />
      {brandLine ? <p className="plate__brand">{brandLine}</p> : null}
      <h1 className="plate__title">{title}</h1>
      {sub ? <p className="plate__sub">{sub}</p> : null}
      {children}
    </Tag>
  );
}
