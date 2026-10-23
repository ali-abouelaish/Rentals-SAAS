// Edge-runtime Sentry (middleware). Imported from src/instrumentation.ts register().

import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "./shared";

Sentry.init({
  ...baseSentryOptions,
  environment: process.env.SENTRY_ENVIRONMENT ?? "production",
});
