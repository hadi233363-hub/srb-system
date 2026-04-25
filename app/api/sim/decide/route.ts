import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureStarted } from "@/lib/sim/engine";
import { applyDecision, forceSpawnScenario } from "@/lib/sim/decisions";
import { getState, broadcast } from "@/lib/sim/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DecideBody {
  scenarioId: string;
  choiceKey: string;
}

interface SpawnBody {
  templateId: string;
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  ensureStarted();
  let body: DecideBody | SpawnBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const state = getState();

  if ("templateId" in body) {
    const s = forceSpawnScenario(state, body.templateId);
    if (!s) return NextResponse.json({ error: "cannot spawn" }, { status: 400 });
    // Manually-triggered scenarios don't expire — the CEO owns them until decided.
    // (Auto-spawned ones still expire via the tick, producing "nothing" outcomes.)
    s.expiresAt = state.simTime + 365 * 24 * 60 * 60 * 1000;
    state.scenarios.push(s);
    broadcast({ type: "snapshot", payload: state });
    return NextResponse.json({ ok: true, scenario: s });
  }

  if (!("scenarioId" in body) || !body.scenarioId || !body.choiceKey) {
    return NextResponse.json({ error: "scenarioId + choiceKey required" }, { status: 400 });
  }

  const record = applyDecision(state, body.scenarioId, body.choiceKey);
  if (!record) return NextResponse.json({ error: "scenario or choice not found" }, { status: 404 });
  broadcast({ type: "snapshot", payload: state });
  return NextResponse.json({ ok: true, record });
}
