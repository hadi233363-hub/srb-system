// Route protection (Next.js 16 Proxy; replaces middleware.ts).
// Uses the edge-safe auth.config — no DB access here.

import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_PREFIXES = ["/api/auth"];

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isAuthed = !!req.auth;

  const isPublic =
    PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  if (!isAuthed && !isPublic) {
    // API routes: return JSON 401 (EventSource etc. shouldn't get a login redirect)
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }

  if (isAuthed && path === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals, static files, and SSE stream
  // (Auth handled inside the SSE route itself if needed later).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
