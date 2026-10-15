import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

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

export default buildConfig;
