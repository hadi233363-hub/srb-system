// Route protection (Next.js 16 Proxy; replaces middleware.ts).
// Uses the edge-safe auth.config — no DB access here.
//
// Layers, in order:
//   1) Authentication      — anon → /login (or 401 for /api/*)
//   2) Admin RBAC          — non-admins blocked from /admin/* and admin-only API
//   3) CSRF (double-submit) — mutating /api/* must echo the csrf-token cookie
//   4) CSRF cookie issuance — set the cookie on first authed visit

import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "./auth.config";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  generateCsrfToken,
  timingSafeEqual,
} from "@/lib/csrf";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/login", "/403"]);
const PUBLIC_PREFIXES = ["/api/auth"];

// Paths reserved for admins. Includes UI routes under /admin/* and the legacy
// /api/sim/* control surface (CEO-only actions).
const ADMIN_PREFIXES = [
  "/admin",
  "/api/admin",
  "/api/sim/control",
  "/api/sim/decide",
  "/api/sim/action",
];

// API paths exempt from CSRF — Auth.js endpoints have their own CSRF guard.
const CSRF_EXEMPT_PREFIXES = ["/api/auth"];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function startsWithSegment(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

function isAdminPath(path: string): boolean {
  return ADMIN_PREFIXES.some((p) => startsWithSegment(path, p));
}

function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => startsWithSegment(path, p));
}

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const method = req.method.toUpperCase();
  const isAuthed = !!req.auth;
  const role = req.auth?.user?.role;

  const isPublic =
    PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  // 1) Authentication
  if (!isAuthed && !isPublic) {
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

  // 2) Admin RBAC — runs after auth so we know the role.
  if (isAuthed && isAdminPath(path) && role !== "admin") {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/403";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 3) CSRF — only enforced on state-changing /api/* requests.
  if (
    isAuthed &&
    path.startsWith("/api/") &&
    !isCsrfExempt(path) &&
    !SAFE_METHODS.has(method)
  ) {
    const cookieToken = req.cookies.get(CSRF_COOKIE)?.value ?? "";
    const headerToken = req.headers.get(CSRF_HEADER) ?? "";
    if (
      !cookieToken ||
      !headerToken ||
      !timingSafeEqual(cookieToken, headerToken)
    ) {
      return NextResponse.json({ error: "csrf" }, { status: 403 });
    }
  }

  // 4) Issue a CSRF cookie if the authed session doesn't have one yet.
  const res = NextResponse.next();
  if (isAuthed && !req.cookies.get(CSRF_COOKIE)) {
    res.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return res;
});

export const config = {
  // Run on everything except Next internals, static files, and SSE stream
  // (Auth handled inside the SSE route itself if needed later).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
