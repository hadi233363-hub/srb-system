// Search endpoint that powers the client combobox in the new-project form
// and any future autocomplete inputs that need a client picker.
//
// Public to ANY authenticated active user — the combobox shows up wherever
// a project is being authored, and the data is just (name, phone). The
// /clients page itself is gated separately on the `clients:view` permission.

import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth-guards";
import { searchClients } from "@/app/clients/actions";

export async function GET(req: Request) {
  try {
    await requireActiveUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(20, Math.max(1, parseInt(limitRaw ?? "10", 10) || 10));

  const results = await searchClients(q, limit);
  return NextResponse.json({ ok: true, results });
}
