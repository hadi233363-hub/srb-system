import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow requests through the Cloudflare quick tunnel in dev.
  // Tunnels give random *.trycloudflare.com subdomains, so we whitelist the whole suffix.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
