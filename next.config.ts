import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP — strict by default; relaxes only what Next.js / Tailwind / Google fonts
// genuinely need. 'unsafe-inline' on style-src covers Next's inline <style> tags
// and Tailwind's runtime utilities. 'unsafe-eval' is dev-only for HMR.
//
// frame-src: needed because the photo-shoot detail page embeds the location
// as a Google Maps iframe. Without this entry the directive falls back to
// default-src 'self' and the map renders as a blocked-content placeholder.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  // Allow embedded Google Maps + YouTube. Both used by the shoots page (map)
  // and likely future surfaces (reference videos in shot lists).
  "frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com",
  // Worker scripts — service worker (push notifications) lives at /sw.js so
  // it loads from same-origin; this entry stops Next.js from blocking
  // worker registration in production builds.
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Allow requests through the Cloudflare quick tunnel in dev.
  // Tunnels give random *.trycloudflare.com subdomains, so we whitelist the whole suffix.
  allowedDevOrigins: ["*.trycloudflare.com"],

  // better-sqlite3 is a native (C++) module loaded at runtime — leave it
  // outside the bundler so Next.js doesn't try to inline its prebuilt binaries.
  // Without this the production build fails with "Cannot find module ../build/Release/better_sqlite3.node".
  serverExternalPackages: ["better-sqlite3"],

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
