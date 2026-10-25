import { cssVars } from "../icons";

/** Each window of the two houses, as a fraction of the picture: x, y, width, height. */
const ROOMS: Array<{ x: number; y: number; w: number; h: number; name: string }> = [
  { x: 0.1464, y: 0.2609, w: 0.0443, h: 0.0809, name: "Room 1 · House A" },
  { x: 0.2727, y: 0.2609, w: 0.0443, h: 0.0809, name: "Room 2 · House A" },
  { x: 0.4019, y: 0.2609, w: 0.0443, h: 0.0809, name: "Room 3 · House A" },
  { x: 0.5569, y: 0.2609, w: 0.0443, h: 0.0809, name: "Room 1 · House B" },
  { x: 0.6842, y: 0.2609, w: 0.0443, h: 0.0809, name: "Room 2 · House B" },
  { x: 0.8108, y: 0.2609, w: 0.0443, h: 0.0809, name: "Room 3 · House B" },
  { x: 0.1449, y: 0.428, w: 0.047, h: 0.158, name: "Room 4 · House A" },
  { x: 0.2719, y: 0.428, w: 0.047, h: 0.158, name: "Room 5 · House A" },
  { x: 0.4005, y: 0.428, w: 0.047, h: 0.147, name: "Room 6 · House A" },
  { x: 0.5554, y: 0.428, w: 0.047, h: 0.147, name: "Room 4 · House B" },
  { x: 0.6827, y: 0.428, w: 0.047, h: 0.158, name: "Room 5 · House B" },
  { x: 0.809, y: 0.428, w: 0.047, h: 0.158, name: "Room 6 · House B" },
  { x: 0.1448, y: 0.6638, w: 0.048, h: 0.16, name: "Room 7 · House A" },
  { x: 0.2734, y: 0.6638, w: 0.048, h: 0.16, name: "Room 8 · House A" },
  { x: 0.6849, y: 0.6638, w: 0.048, h: 0.16, name: "Room 7 · House B" },
  { x: 0.8105, y: 0.6638, w: 0.048, h: 0.16, name: "Room 8 · House B" },
];

/**
 * Why Harbor: the same two houses as the hero, counted two ways. The switch plays once on its own
 * (by the flat, then by the room: every window lights up), then it's the visitor's.
 */
export function WhyHarbor() {
  return (
    <section className="why" id="why" aria-labelledby="why-label">
      <div className="wrap grid">
        <h2 className="label" id="why-label">
          Why Harbor
        </h2>
        <p className="why__text" data-fill>
          <span className="t1">London doesn’t rent by the flat. It rents by the room.</span>{" "}
          <span className="t2">
            Most property software assumes one tenant per unit. Harbor is built rooms-first, so your numbers match how
            you actually let.
          </span>
        </p>
      </div>
      <div className="wrap">
        <div className="count" id="count" data-mode="room">
          <div className="count__top">
            <div className="count__switch" role="group" aria-label="Count these two houses">
              <button type="button" data-to="flat" aria-pressed="false">
                <i />
                <span>By the flat</span>
              </button>
              <button type="button" data-to="room" aria-pressed="true">
                <i />
                <span>By the room</span>
              </button>
            </div>
            <p className="count__sum">
              <b className="count__n" aria-hidden="true">
                16
              </b>
              <span className="count__what" aria-hidden="true">
                rooms, each with its own tenancy
              </span>
              <span className="count__say sr-only" aria-live="polite">
                16 rooms, each with its own tenancy
              </span>
            </p>
          </div>
          <div className="count__stage">
            <div className="count__house">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/site/street/street-house-1400.webp?v=brand1"
                srcSet="/site/street/street-house-1400.webp?v=brand1 1400w, /site/street/street-house-2200.webp?v=brand1 2200w"
                sizes="(max-width: 600px) 124vw, 860px"
                width={1400}
                height={939}
                alt="Two London townhouses side by side, one sage and one cream"
                loading="lazy"
                decoding="async"
              />
              <span className="count__unit" style={cssVars({ "--x": "7.4%", "--w": "42.3%" })}>
                <b>Unit 1</b>
              </span>
              <span className="count__unit" style={cssVars({ "--x": "50.3%", "--w": "42.3%" })}>
                <b>Unit 2</b>
              </span>
              <div className="count__rooms" aria-hidden="true">
                {ROOMS.map((room, n) => (
                  <span
                    key={room.name}
                    className="count__room"
                    style={cssVars({ "--x": room.x, "--y": room.y, "--w": room.w, "--h": room.h, "--n": n })}
                    data-name={room.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
