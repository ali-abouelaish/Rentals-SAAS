/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
