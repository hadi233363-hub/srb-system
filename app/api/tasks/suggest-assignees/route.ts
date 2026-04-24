// Smart assignee suggestions for the new-task modal.
// POST { title, description?, projectId?, requiredBadgeSlugs? }
//   → { suggestions, inferredBadgeSlugs, filteredByBadge }
//
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
    requiredBadgeSlugs?: string[];
    limit?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const requiredBadgeSlugs = Array.isArray(body.requiredBadgeSlugs)
    ? body.requiredBadgeSlugs.filter((s) => typeof s === "string" && s.length > 0)
    : [];

  // Run when there's *something* to act on — text OR explicit badges.
  if (title.length < 2 && requiredBadgeSlugs.length === 0) {
    return NextResponse.json({
      suggestions: [],
      inferredBadgeSlugs: [],
      filteredByBadge: false,
    });
  }

  const result = await suggestAssignees({
    title,
    description: body.description ?? null,
    projectId: body.projectId ?? null,
    requiredBadgeSlugs,
    limit: Math.min(Math.max(body.limit ?? 5, 1), 10),
  });

  return NextResponse.json(result);
}
