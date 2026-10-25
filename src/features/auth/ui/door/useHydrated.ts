"use client";

import { useEffect, useState } from "react";

/**
 * False until the page has hydrated. The door's submit buttons stay disabled until then, so a form
 * can't be sent natively before React's handler is attached (which, for a client-only form, would
 * put the password in the URL).
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
