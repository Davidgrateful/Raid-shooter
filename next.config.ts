import type { NextConfig } from "next";

// A build id that changes on every deploy. Used to cache-bust the static
// /game/*.js engine files, which browsers and the CDN otherwise cache by
// their fixed paths - the cause of "I don't see my changes" after a deploy.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;
