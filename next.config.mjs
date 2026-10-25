import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
// The build wrapper has its own entry in @sentry/nextjs v11; the package root
// no longer exports it.
import { withSentryConfig } from "@sentry/nextjs/config";

/** @param {string} phase @returns {import('next').NextConfig} */
const buildConfig = (phase) => ({
  // `next dev` and `next build` both write to the dist dir; sharing it makes a
  // build wipe the dev server's CSS/chunks (404s, broken layout). Keep dev separate.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yblbulibirkyoyuzhosy.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  },
  // The public website's images (public/site/): cached for a week, as the designer specified. The
  // pages link them with a ?v= version, so a replaced image shows once its ?v= is changed.
  async headers() {
    return [
      {
        source: "/site/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }]
      }
    ];
  },
  experimental: {
    // Enables src/instrumentation.ts (required on Next 14; default on 15+).
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: "20mb"
    }
  },
  webpack: (config) => {
    // handlebars/lib/index.js touches require.extensions, which webpack can't
    // statically support. That codepath is only hit when handlebars is loaded
    // by plain Node, and we only use it server-side (src/lib/email/render.ts),
    // so the warning is noise — drop it rather than let it flood dev output.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { message: /require\.extensions is not supported by webpack/ }
    ];
    return config;
  }
});

// Sentry build step: injects src/instrumentation-client.ts and uploads source
// maps. Builds run on the deploy machine (scripts/deploy.sh), so SENTRY_ORG,
// SENTRY_PROJECT and SENTRY_AUTH_TOKEN live there — in .env.local or
// .env.sentry-build-plugin, which the plugin reads itself. Without a token the
// build still succeeds; it just skips the upload.
export default withSentryConfig(buildConfig, {
  // Browser events go through our own server so ad-blockers don't drop them.
  // Excluded from the middleware matcher, or logged-out pages would bounce it to /login.
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  sourcemaps: {
    // Otherwise the client .map files are rsynced to the VPS and served publicly.
    deleteSourcemapsAfterUpload: true
  },
  // No Session Replay, so none of its code ships. Tracing code is left in: the
  // server's per-request scope isolation (which keeps one request's user/tenant
  // off another's events) is built on it.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true
  },
  // We don't trace navigations, so the hook this warns about is not needed.
  suppressOnRouterTransitionStartWarning: true,
  silent: !process.env.SENTRY_DEBUG,
  telemetry: false
});
