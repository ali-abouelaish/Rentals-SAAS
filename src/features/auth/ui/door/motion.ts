/**
 * The front door's moments, ported from the designer's js/auth.js. Browser-only: call these from
 * event handlers and effects in client components.
 */

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Signed in: the door swings open onto the hallway. The CSS does the swing from the wrapper's
 * .is-open class (and fades the door instead under reduced motion).
 */
export function openDoor(from: Element | null): void {
  from?.closest(".harbor-door")?.classList.add("is-open");
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/**
 * Signed in, and on to the workspace: the door swings open, then we walk down the hallway towards
 * the window at the far end until its light fills the screen with the app's background. Resolves
 * once the screen is that colour, so the caller can navigate without a flash (the browser keeps
 * the last frame until the dashboard paints). Under reduced motion it only opens the door.
 */
export async function walkIn(from: Element | null): Promise<void> {
  openDoor(from);
  const root = from?.closest<HTMLElement>(".harbor-door");
  const hall = root?.querySelector<HTMLImageElement>(".hall img");
  if (prefersReducedMotion() || !root || !hall) return;

  await wait(800); // the door is most of the way open

  const light = document.createElement("div");
  light.className = "arrive";
  light.setAttribute("aria-hidden", "true");
  root.append(light);

  // Zoom about the far window, drifting it to the middle of the screen as we go
  const { x, y } = farWindow(hall);
  hall.style.transformOrigin = `${x}px ${y}px`;
  const dx = hall.clientWidth / 2 - x;
  const dy = hall.clientHeight * 0.45 - y;
  // No "from" keyframe: start wherever the hall's own settle transition has got to
  hall.animate({ transform: `translate(${dx}px, ${dy}px) scale(3.4)` }, {
    duration: 1200,
    easing: "cubic-bezier(.5,0,.75,0)",
    fill: "forwards",
  });

  // We pass through the doorway: the frame goes by on either side, the door falls behind
  const pass = { duration: 550, easing: "cubic-bezier(.5,0,.9,.5)", fill: "forwards" } as const;
  root.querySelector(".frame--l")?.animate({ transform: "translateX(-100%)" }, pass);
  root.querySelector(".frame--r")?.animate({ transform: "translateX(100%)" }, pass);
  root.querySelector(".stage")?.animate({ opacity: 0, transform: "translateX(-10vw) scale(1.15)" }, pass);

  await light.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 450,
    delay: 750,
    easing: "ease-in",
    fill: "forwards",
  }).finished;
}

/**
 * Where the window at the end of the hall is on screen. hallway.webp is 1376×768, drawn with
 * object-fit: cover at object-position 58% 50%; the window is at 50% / 47% of the picture.
 */
function farWindow(img: HTMLImageElement): { x: number; y: number } {
  const w = img.clientWidth;
  const h = img.clientHeight;
  const s = Math.max(w / 1376, h / 768);
  return {
    x: (w - 1376 * s) * 0.58 + 1376 * s * 0.5,
    y: (h - 768 * s) * 0.5 + 768 * s * 0.47,
  };
}

/** Wrong password: the enamel sign rattles on its screws. */
export function rattle(plate: HTMLElement | null): void {
  if (!plate) return;
  plate.classList.remove("is-rattling");
  void plate.offsetWidth; // restart the animation
  plate.classList.add("is-rattling");
}

/** The knocker swings when it's knocked. */
export function knock(knocker: HTMLElement): void {
  knocker.classList.remove("is-knocking");
  void knocker.offsetWidth;
  knocker.classList.add("is-knocking");
}

/**
 * Demo request sent: the card turns over to its picture side, like a postcard, and goes through the
 * letterbox. Resolves when it has gone (straight away under reduced motion), so the caller can show
 * the "Request received" plate in its place.
 */
export async function postCard(card: HTMLElement, box: HTMLElement): Promise<void> {
  const reduce = prefersReducedMotion();
  box.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  await wait(reduce ? 60 : 750);
  if (reduce) return;

  const turn = "perspective(1600px) rotateY(";
  await card.animate([{ transform: "none" }, { transform: `${turn}90deg)` }], {
    duration: 300,
    easing: "cubic-bezier(.5,0,.9,.5)",
    fill: "forwards",
  }).finished;
  card.classList.add("is-sealed");
  await card.animate([{ transform: `${turn}-90deg)` }, { transform: "none" }], {
    duration: 380,
    easing: "cubic-bezier(.1,.5,.4,1)",
    fill: "forwards",
  }).finished;
  await wait(280);

  const c = card.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const s = (b.width * 0.7 * 0.9) / c.width; // the slot is 70% of the plate's width
  const dx = b.left + b.width * 0.482 - (c.left + c.width / 2);
  const dy = b.top + b.height * 0.27 - (c.top + c.height * s); // card's bottom edge on the slot's top edge
  const at = `translate(${dx}px, ${dy}px) scale(${s})`;
  await card.animate([{ transform: "none" }, { transform: at }], {
    duration: 950,
    easing: "cubic-bezier(.6,.04,.22,1)",
    fill: "forwards",
  }).finished;

  box.classList.add("is-open");
  await wait(230);
  await card.animate(
    [
      { transform: at, clipPath: "inset(0 0 0 0)" },
      { transform: `translate(${dx}px, ${dy + c.height * s}px) scale(${s})`, clipPath: "inset(0 0 100% 0)" },
    ],
    { duration: 700, easing: "cubic-bezier(.45,0,.75,.4)", fill: "forwards" }
  ).finished;
  box.classList.remove("is-open");
  box.classList.add("is-clacking");
  setTimeout(() => box.classList.remove("is-clacking"), 400);
}
