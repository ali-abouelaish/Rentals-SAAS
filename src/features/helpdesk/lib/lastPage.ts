"use client";

import { useEffect } from "react";

/**
 * Remembers the last in-app page a user was on BEFORE opening Contact Support.
 *
 * The ticket dialog only exists on /helpdesk, so reading window.location at
 * submit time would always say "/helpdesk". Instead the app shell records every
 * route change here and the dialog reads the most recent non-helpdesk one —
 * usually the page the problem is on.
 *
 * sessionStorage: per tab, gone when the tab closes. Pathname only (no query
 * string) so tokens or search terms never end up in a ticket. Every access is
 * wrapped — storage can throw in private windows and must never break the app.
 */
const KEY = "helpdesk:last-page";

function isHelpdesk(pathname: string): boolean {
  return pathname === "/helpdesk" || pathname.startsWith("/helpdesk/");
}

export function useTrackLastPage(pathname: string) {
  useEffect(() => {
    if (!pathname || isHelpdesk(pathname)) return;
    try {
      sessionStorage.setItem(KEY, pathname);
    } catch {
      // Storage unavailable — the ticket just won't carry a page.
    }
  }, [pathname]);
}

/** Absolute URL of the last non-helpdesk page, or null if there wasn't one. */
export function readLastPage(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    return path ? `${window.location.origin}${path}` : null;
  } catch {
    return null;
  }
}
