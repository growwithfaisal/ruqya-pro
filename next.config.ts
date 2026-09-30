import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Changes on every deploy; names the service worker and its caches.
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? String(Date.now()),
  },
  async headers() {
    return [
      // The worker itself must never be cached, or installed apps could not learn about a new deploy.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
