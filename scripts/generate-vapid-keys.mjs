#!/usr/bin/env node
// Generate a fresh VAPID keypair for Web Push.
// Usage:  node scripts/generate-vapid-keys.mjs
// Then add the printed values to Railway → Variables (or .env.local for dev):
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...
//   VAPID_SUBJECT=mailto:you@yourcompany.com   (optional but recommended)
//
// Run this exactly ONCE — rotating the keys will invalidate every existing
// push subscription, so users would have to re-enable notifications.

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\n=== SRB Web Push — VAPID keypair ===\n");
console.log("Add these to Railway → your service → Variables:\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@srb.network`);
console.log("\nKeep VAPID_PRIVATE_KEY secret. The public key is safe to expose.");
console.log("After saving the variables, redeploy the service (Railway will do this automatically).\n");
