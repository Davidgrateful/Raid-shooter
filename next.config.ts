import type { NextConfig } from "next";

// A build id that changes on every deploy. Used to cache-bust the static
// /game/*.js engine files, which browsers and the CDN otherwise cache by
// their fixed paths - the cause of "I don't see my changes" after a deploy.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

// Baseline security headers applied to every response. CSP is intentionally
// permissive on connect/img/frame (https:/wss:) so the wallet stack (Reown/
// WalletConnect relays + Base RPC) keeps working, while still blocking
// third-party script injection beyond our own bundle. 'unsafe-eval'/'unsafe-
// inline' are required by the wallet libraries and the canvas engine.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // force HTTPS for two years incl. subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // stop MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // clickjacking protection (belt-and-braces with frame-ancestors)
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // we don't use these device APIs - deny them outright
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
