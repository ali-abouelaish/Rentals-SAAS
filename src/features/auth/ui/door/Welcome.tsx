"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The pill in the hallway once the door has swung open ("Welcome back. Opening your workspace…").
 *
 * Portalled onto the .harbor-door wrapper: it's position: fixed, and inside the door it would be
 * fixed to the door instead (a transformed ancestor), and swing away with it. Always rendered once
 * mounted, so the CSS can fade it in a moment after the wrapper gets .is-open; announce the moment
 * separately (an sr-only role="status").
 */
export function Welcome({ open, text = "Welcome back. Opening your workspace…" }: { open: boolean; text?: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.querySelector<HTMLElement>(".harbor-door")), []);
  if (!host) return null;
  return createPortal(
    <div className="welcome" aria-hidden={!open}>
      <span className="spin" aria-hidden="true" />
      <span>{text}</span>
    </div>,
    host
  );
}
