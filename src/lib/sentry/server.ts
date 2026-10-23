// Node-runtime Sentry. Imported first thing in src/instrumentation.ts register(),
// before the cron scheduler and email worker start, so their failures are caught.

import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "./shared";

Sentry.init({
  ...baseSentryOptions,
  environment: process.env.SENTRY_ENVIRONMENT ?? "production",
  integrations: [
    // Next 14 has no onRequestError hook and the SDK does not wrap server
    // actions, but Next logs every failed action with console.error — as do our
    // own catch blocks. An Error among the arguments is captured as an exception
    // (and skipped if the SDK already captured that same object).
    Sentry.captureConsoleIntegration({ levels: ["error"] }),
  ],
});
