"use client";

import { knock } from "./motion";

/** The brass knocker above the sign-in plate. Purely for fun: it swings when you knock. */
export function Knocker() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="knocker"
      src="/site/door/knocker.webp"
      alt=""
      aria-hidden="true"
      width={480}
      height={608}
      onClick={(e) => knock(e.currentTarget)}
    />
  );
}
