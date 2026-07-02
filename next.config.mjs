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
  }
};

export default nextConfig;
