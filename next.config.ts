import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow requests through the Cloudflare quick tunnel in dev.
  // Tunnels give random *.trycloudflare.com subdomains, so we whitelist the whole suffix.
  allowedDevOrigins: ["*.trycloudflare.com"],

  // better-sqlite3 is a native (C++) module loaded at runtime — leave it
  // outside the bundler so Next.js doesn't try to inline its prebuilt binaries.
  // Without this the production build fails with "Cannot find module ../build/Release/better_sqlite3.node".
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
