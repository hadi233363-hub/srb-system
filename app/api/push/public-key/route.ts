// Returns the VAPID public key the browser needs to register a push
// subscription. Public by design — there's nothing secret about this key.

import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push/web-push";

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json({ publicKey: null, configured: false });
  }
  return NextResponse.json({
    publicKey: getVapidPublicKey(),
    configured: true,
  });
}
