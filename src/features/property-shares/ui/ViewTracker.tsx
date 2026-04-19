"use client";

import { useEffect } from "react";

interface ViewTrackerProps {
  token: string;
}

export function ViewTracker({ token }: ViewTrackerProps) {
  useEffect(() => {
    const key = `viewed-${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      return;
    }
    fetch(`/api/shares/${encodeURIComponent(token)}/track`, {
      method: "POST",
      keepalive: true,
    })
      .then(() => {
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Tracking is best-effort — swallow errors so they never surface to viewers.
      });
  }, [token]);

  return null;
}
