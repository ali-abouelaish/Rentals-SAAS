// Browser-side Sentry. Next 14 has no instrumentation-client hook of its own;
// @sentry/nextjs's webpack config finds this file and injects it into the client
// entry. Errors only — no tracing, and no Session Replay: renter passports, lead
// details and bank info are on screen.

import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/sentry/shared";

const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

Sentry.init({
  ...baseSentryOptions,
  // A production build served locally (`npm start`) still reports, but under
  // its own environment so smoke tests stay out of the production issue stream.
  environment: isLocal ? "local" : "production",
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
  ],
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
});
