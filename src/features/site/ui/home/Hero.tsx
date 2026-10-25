import { Pill } from "../icons";
import { HARBOR_OUTLINE_PATHS, HARBOR_OUTLINE_VIEWBOX } from "./logoOutline";

/**
 * Harbor Street. On computers, as you scroll: the headline clears, HARBOR draws itself on open sky,
 * the townhouses rise into the outline and fill it, the logo settles to teal and docks into the
 * nav. On phones the same story plays once by itself. The drawing is done in motion/homeMotion.ts.
 */
export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero__stage" id="heroStage">
        <div className="hero__sky" aria-hidden="true">
          <picture>
            <source
              media="(max-aspect-ratio: 9/10)"
              srcSet="/site/street/sky-p-1080.webp?v=brand1 1080w, /site/street/sky-p.webp?v=brand1 1440w"
              sizes="130vw"
            />
            {/* The pre-paint script adds .is-in when the photo has loaded, often before hydration. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="hero__plate"
              suppressHydrationWarning
              src="/site/street/sky-l-1600.webp?v=brand1"
              srcSet="/site/street/sky-l-1600.webp?v=brand1 1600w, /site/street/sky-l.webp?v=brand1 2560w"
              sizes="112vw"
              alt=""
              decoding="async"
            />
          </picture>
        </div>
        <div className="hero__mist hero__mist--back" aria-hidden="true">
          <i />
        </div>

        <div className="hero__copy" id="heroCopy">
          <h1 className="hero__title" id="hero-title">
            <span className="line">Property management,</span> <span className="line">room by room.</span>
          </h1>
          <p className="hero__sub">
            <span className="t2">Built for the way</span> <span className="t1">London rents.</span>
          </p>
          <Pill href="/signup">Request a demo</Pill>
        </div>

        <div className="hero__house" id="heroHouse">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/site/street/street-house-2200.webp?v=brand1"
            srcSet="/site/street/street-house-1400.webp?v=brand1 1400w, /site/street/street-house-2200.webp?v=brand1 2200w, /site/street/street-house.webp?v=brand1 3033w"
            sizes="(max-aspect-ratio: 9/10) 180vw, 64vw"
            alt="Two London townhouses, one painted sage and one cream, with deep teal front doors"
            width={3033}
            height={2035}
            fetchPriority="high"
          />
        </div>
        <div className="hero__mist hero__mist--front" aria-hidden="true">
          <i />
          <i />
        </div>

        <div className="hero__logo" id="heroLogo" aria-hidden="true">
          <div className="hero__fillwrap" id="heroFill">
            <div className="hero__fill">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/site/street/street-house-duo-2200.webp?v=brand1"
                srcSet="/site/street/street-house-duo-1400.webp?v=brand1 1400w, /site/street/street-house-duo-2200.webp?v=brand1 2200w, /site/street/street-house-duo.webp?v=brand1 3033w"
                sizes="(max-aspect-ratio: 9/10) 180vw, 64vw"
                alt=""
              />
            </div>
            <div className="hero__solid" id="heroSolid" />
          </div>
          <svg className="hero__outline" id="heroOutline" viewBox={HARBOR_OUTLINE_VIEWBOX} preserveAspectRatio="xMidYMin meet">
            {HARBOR_OUTLINE_PATHS.map((d, i) => (
              // a fixed list: its order is its identity
              <path key={i} d={d} />
            ))}
          </svg>
        </div>

        <div className="hero__veil" id="heroVeil" />
        <div className="hero__cue" id="heroCue" aria-hidden="true">
          Scroll
          <i />
        </div>
      </div>
    </section>
  );
}
