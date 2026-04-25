import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureStarted, setPaused, setSpeed } from "@/lib/sim/engine";
import { resetSim } from "@/lib/sim/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ControlBody {
  action: "pause" | "play" | "speed" | "reset";
  value?: number;
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  ensureStarted();

  let body: ControlBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  switch (body.action) {
    case "pause":
      setPaused(true);
      break;
    case "play":
      setPaused(false);
      break;
    case "speed":
      if (typeof body.value !== "number") {
        return NextResponse.json({ error: "value required" }, { status: 400 });
      }
      setPaused(false);
      setSpeed(body.value);
      break;
    case "reset":
      resetSim();
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
