import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureStarted } from "@/lib/sim/engine";
import {
  boostProjectPriority,
  cancelProject,
  fireAgent,
  giveBonus,
  hireAgent,
  raiseSalary,
  setHiringPause,
  teamRetreat,
} from "@/lib/sim/actions";
import { broadcast, getState } from "@/lib/sim/state";
import type { Role } from "@/lib/sim/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ActionBody {
  type: string;
  params?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  ensureStarted();
  let body: ActionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const state = getState();
  const p = body.params ?? {};
  let result: { ok: boolean; message: string };

  switch (body.type) {
    case "hire":
      result = hireAgent(state, {
        role: p.role as Role,
        seniority: (p.seniority as "junior" | "mid" | "senior") ?? "junior",
      });
      break;
    case "fire":
      result = fireAgent(state, p.agentId as string);
      break;
    case "raise_salary":
      result = raiseSalary(state, p.agentId as string, (p.pct as number) ?? 10);
      break;
    case "bonus":
      result = giveBonus(state);
      break;
    case "retreat":
      result = teamRetreat(state);
      break;
    case "hiring_pause":
      result = setHiringPause(state, Boolean(p.paused));
      break;
    case "cancel_project":
      result = cancelProject(state, p.projectId as string);
      break;
    case "priority_boost":
      result = boostProjectPriority(state, p.projectId as string);
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  broadcast({ type: "snapshot", payload: state });
  return NextResponse.json(result);
}
