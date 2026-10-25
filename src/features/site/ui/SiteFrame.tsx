import type { ReactNode } from "react";
import { urbanist } from "../fonts";

type Variant = "home" | "legal" | "404";

const ROOT_CLASS: Record<Variant, string> = {
  home: "harbor-home",
  legal: "harbor-legal",
  "404": "harbor-404",
};

/**
 * Runs while the homepage is still being parsed, before its first paint (the designer's <head>
 * script, moved onto the page's own wrapper):
 * - .is-js: the page is scripted, so things can wait to animate in;
 * - .is-lite: phones, tablets and narrow windows get the lighter, non-scrubbed motion;
 * - .is-reduce: the device asks for reduced motion, so everything shows in its final state;
 * - the sky photo fades in once it has loaded (the design's inline onload);
 * - a watchdog: if the motion code hasn't started (marked .is-motion) a few seconds later, say
 *   because its chunk failed to load after a deploy, fall back to the still version so nothing
 *   waits to be revealed forever. Production only: a cold dev compile is slower than that.
 */
function homePrepaint(withWatchdog: boolean): string {
  return `(function () {
  var r = document.currentScript.parentElement, m = window.matchMedia;
  r.classList.add('is-js');
  if (m('(prefers-reduced-motion: reduce)').matches) r.classList.add('is-reduce');
  if (m('(hover: none) and (pointer: coarse)').matches || m('(max-width: 900px)').matches) r.classList.add('is-lite');
  r.addEventListener('load', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('hero__plate')) t.classList.add('is-in');
  }, true);
  ${withWatchdog ? "setTimeout(function () { if (!r.classList.contains('is-motion')) r.classList.add('is-reduce'); }, 4000);" : ""}
})();`;
}

/**
 * The wrapper every public-website page draws inside: it carries the page's scoped stylesheet
 * (home.css, legal.css or not-found.css, imported by the page) and the Urbanist font.
 *
 * The className stays a constant string: React leaves the classes added at runtime alone only
 * while the prop itself never changes.
 */
export function SiteFrame({ variant, children }: { variant: Variant; children: ReactNode }) {
  return (
    <div className={`${ROOT_CLASS[variant]} ${urbanist.variable}`} suppressHydrationWarning>
      {variant === "home" ? (
        <script dangerouslySetInnerHTML={{ __html: homePrepaint(process.env.NODE_ENV === "production") }} />
      ) : null}
      {children}
    </div>
  );
}
