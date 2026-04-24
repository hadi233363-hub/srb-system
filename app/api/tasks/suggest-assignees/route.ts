// Smart assignee suggestions for the new-task modal.
// POST { title, description?, projectId? } → top-3 ranked candidates.
// Available to anyone who can create tasks (any active user).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { suggestAssignees } from "@/lib/tasks/suggest-assignees";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    description?: string | null;
    projectId?: string | null;
    limit?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (title.length < 2) {
    // Don't run on a single-letter title — would just sort everyone by workload.
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await suggestAssignees({
    title,
    description: body.description ?? null,
    projectId: body.projectId ?? null,
    limit: Math.min(Math.max(body.limit ?? 3, 1), 10),
  });

  return NextResponse.json({ suggestions });
}
