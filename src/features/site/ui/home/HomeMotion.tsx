"use client";

import { useEffect } from "react";
import { startHomeMotion } from "../../motion/homeMotion";

/**
 * Starts the homepage's motion once the page has hydrated, and stops it again on the way out.
 * Marks the wrapper .is-motion so the pre-paint watchdog (SiteFrame) stands down; if anything
 * throws while starting, the page falls back to its still version (.is-reduce) rather than leaving
 * content waiting to animate in.
 */
export function HomeMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".harbor-home");
    if (!root) return;
    let stop: (() => void) | undefined;
    try {
      stop = startHomeMotion(root);
      root.classList.add("is-motion");
    } catch (err) {
      console.error("[home] motion could not start", err);
      root.classList.add("is-reduce");
    }
    return () => {
      root.classList.remove("is-motion");
      stop?.();
    };
  }, []);

  return null;
}
