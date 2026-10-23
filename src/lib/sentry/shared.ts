import { scrubBreadcrumb, scrubEvent } from "./scrub";

// One public DSN for every runtime. NEXT_PUBLIC_ means it is inlined at build
// time, and builds run on the deploy machine (scripts/deploy.sh), so it lives in
// that machine's .env.local — the VPS needs nothing.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Options every runtime shares. Errors only: no tracing, no Session Replay.
 * Off in `next dev`, and off entirely until a DSN is configured.
 */
export const baseSentryOptions = {
  dsn,
  enabled: process.env.NODE_ENV === "production" && Boolean(dsn),
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
