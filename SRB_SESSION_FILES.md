# ملفات نظام SRB — هذي الجلسة

كل الملفات اللي اتعدّلت أو انشأت في الجلسة هذي مجموعة في ملف واحد للمراجعة.

**Branch:** `main` · **Date:** 2026-04-29 21:12 UTC

## المحتويات

1. [`lib/auth/roles.ts`](#lib-auth-roles-ts)
2. [`lib/auth-guards.ts`](#lib-auth-guards-ts)
3. [`types/next-auth.d.ts`](#types-next-auth-d-ts)
4. [`auth.ts`](#auth-ts)
5. [`auth.config.ts`](#auth-config-ts)
6. [`proxy.ts`](#proxy-ts)
7. [`next.config.ts`](#next-config-ts)
8. [`instrumentation.ts`](#instrumentation-ts)
9. [`prisma/schema.prisma`](#prisma-schema-prisma)
10. [`app/layout.tsx`](#app-layout-tsx)
11. [`components/sidebar.tsx`](#components-sidebar-tsx)
12. [`components/topbar-real.tsx`](#components-topbar-real-tsx)
13. [`app/page.tsx`](#app-page-tsx)
14. [`components/smart-insights.tsx`](#components-smart-insights-tsx)
15. [`lib/insights/smart-insights.ts`](#lib-insights-smart-insights-ts)
16. [`app/finance/page.tsx`](#app-finance-page-tsx)
17. [`app/finance/actions.ts`](#app-finance-actions-ts)
18. [`app/admin/users/page.tsx`](#app-admin-users-page-tsx)
19. [`app/admin/users/actions.ts`](#app-admin-users-actions-ts)
20. [`app/admin/users/users-admin-client.tsx`](#app-admin-users-users-admin-client-tsx)
21. [`app/tasks/actions.ts`](#app-tasks-actions-ts)
22. [`app/api/tasks/upcoming/route.ts`](#app-api-tasks-upcoming-route-ts)
23. [`lib/db/notifications.ts`](#lib-db-notifications-ts)
24. [`app/notifications/actions.ts`](#app-notifications-actions-ts)
25. [`app/api/notifications/recent/route.ts`](#app-api-notifications-recent-route-ts)
26. [`components/notification-bell.tsx`](#components-notification-bell-tsx)
27. [`components/meeting-reminder.tsx`](#components-meeting-reminder-tsx)
28. [`lib/push/web-push.ts`](#lib-push-web-push-ts)
29. [`app/api/push/public-key/route.ts`](#app-api-push-public-key-route-ts)
30. [`app/api/push/subscribe/route.ts`](#app-api-push-subscribe-route-ts)
31. [`app/api/push/unsubscribe/route.ts`](#app-api-push-unsubscribe-route-ts)
32. [`app/api/push/resubscribe/route.ts`](#app-api-push-resubscribe-route-ts)
33. [`components/push-enable-button.tsx`](#components-push-enable-button-tsx)
34. [`public/manifest.json`](#public-manifest-json)
35. [`public/sw.js`](#public-sw-js)
36. [`scripts/generate-vapid-keys.mjs`](#scripts-generate-vapid-keys-mjs)
37. [`lib/reminders/scheduler.ts`](#lib-reminders-scheduler-ts)
38. [`lib/db/audit.ts`](#lib-db-audit-ts)
39. [`app/projects/actions.ts`](#app-projects-actions-ts)
40. [`app/meetings/actions.ts`](#app-meetings-actions-ts)
41. [`app/shoots/actions.ts`](#app-shoots-actions-ts)
42. [`app/shoots/[id]/page.tsx`](#app-shoots--id--page-tsx)
43. [`app/api/projects/billing-due/route.ts`](#app-api-projects-billing-due-route-ts)
44. [`app/api/tasks/suggest-assignees/route.ts`](#app-api-tasks-suggest-assignees-route-ts)
45. [`update-and-run.bat`](#update-and-run-bat)
46. [`.env.local.example`](#-env-local-example)

---

## `lib/auth/roles.ts`

<a id="lib-auth-roles-ts"></a>

```typescript
// Role hierarchy for the SRB internal system. The single source of truth for
// "who can do what". Every server action, API route, sidebar item and UI gate
// goes through these helpers — no raw `role === "admin"` checks anywhere else.
//
// Hierarchy (highest → lowest):
//   admin           → الرئيس (Owner)
//                     · full access to everything, including finance totals
//                     · only one with permission-control-panel access
//
//   manager         → المدير
//                     · runs ops (projects, meetings, shoots, equipment)
//                     · approves users + assigns roles up to team lead
//                     · cannot see finance totals (owner-only)
//
//   department_lead → رئيس الفريق (Team lead)
//                     · manages their team's projects + tasks + freelancers
//                     · cannot approve users, cannot change roles
//                     · cannot see finance totals
//
//   employee        → الموظف
//                     · works on their own tasks, sees the team list
//                     · cannot create projects, transactions, meetings, shoots
//
// Historical note: an extra "head of all departments" tier (`head`) lived
// briefly between `manager` and `department_lead`. It was merged back into
// `department_lead` for simplicity — the team-lead label now covers the
// cross-team coordination role. `instrumentation.ts` runs a one-shot
// migration on boot to convert any leftover `role='head'` rows to `manager`.

export type Role =
  | "admin"
  | "manager"
  | "department_lead"
  | "employee";

export const ALL_ROLES: readonly Role[] = [
  "admin",
  "manager",
  "department_lead",
  "employee",
] as const;

// Numeric rank — higher number = more privileged. Used for `meets()` checks.
const RANK: Record<Role, number> = {
  admin: 4,
  manager: 3,
  department_lead: 2,
  employee: 1,
};

/** True if the user's role is at OR ABOVE the given minimum. */
export function meets(role: string | undefined | null, minimum: Role): boolean {
  if (!role) return false;
  const r = (RANK as Record<string, number | undefined>)[role];
  if (r === undefined) return false;
  return r >= RANK[minimum];
}

export function isOwner(role: string | undefined | null): boolean {
  return meets(role, "admin");
}

export function isManagerOrAbove(role: string | undefined | null): boolean {
  return meets(role, "manager");
}

export function isDeptLeadOrAbove(role: string | undefined | null): boolean {
  return meets(role, "department_lead");
}

/**
 * Backwards-compat alias for the deprecated `head` tier. We treat any caller
 * that asks "is this a head?" as "is this manager or above?" so old call
 * sites keep working while we migrate them. Once every caller is gone this
 * can be removed.
 *
 * @deprecated Use `isManagerOrAbove` instead.
 */
export function isHeadOrAbove(role: string | undefined | null): boolean {
  return isManagerOrAbove(role);
}

/** Validate that a string from a form / API is a known role. */
export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}

/**
 * Roles that `assigner` is allowed to grant. Owners can grant any role.
 * Managers can grant team_lead and below — they can promote into team
 * leadership but not into another manager or owner seat.
 */
export function assignableRoles(assignerRole: string | undefined | null): Role[] {
  if (isOwner(assignerRole))
    return ["admin", "manager", "department_lead", "employee"];
  if (isManagerOrAbove(assignerRole))
    return ["department_lead", "employee"];
  return [];
}

/** True if `assigner` is allowed to grant `target` to a user. */
export function canAssignRole(
  assignerRole: string | undefined | null,
  target: Role
): boolean {
  return assignableRoles(assignerRole).includes(target);
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `lib/auth-guards.ts`

<a id="lib-auth-guards-ts"></a>

```typescript
// Shared server-side auth guards for server actions and API routes.
//
// Every guard checks BOTH that the user is signed in AND that their account
// is active (approved by admin). Pending-approval users can reach the UI via
// a Google sign-in but the layout shows them a PendingGate; without this
// check they could still craft raw server-action / fetch calls and mutate
// data before an admin approves them.
//
// Role hierarchy is defined in lib/auth/roles.ts. Use the helpers there for
// any role check — never compare to literal strings outside this file.

import { auth } from "@/auth";
import {
  isDeptLeadOrAbove,
  isManagerOrAbove,
  isOwner,
  type Role,
} from "@/lib/auth/roles";
import {
  hasPermission as checkPermission,
  type Action,
  type Module,
} from "@/lib/auth/permissions";
import { getUserOverrides } from "@/lib/db/permissions";

interface ActiveUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  active: true;
  department: string | null;
}

export async function requireActiveUser(): Promise<ActiveUser> {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    throw new Error("Not authenticated");
  }
  if (!user.active) {
    throw new Error("Account pending approval");
  }
  return user as ActiveUser;
}

/** Highest tier — الرئيس / President. Sees finance totals, full /admin/*. */
export async function requireOwner(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!isOwner(user.role)) {
    throw new Error("صلاحيات غير كافية: هذي العملية للرئيس فقط");
  }
  return user;
}

/** Manager or above — runs ops, approves users, assigns roles up to dept_lead. */
export async function requireManagerOrAbove(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!isManagerOrAbove(user.role)) {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

/** Team lead or above — adds projects / transactions / meetings / shoots. */
export async function requireDeptLeadOrAbove(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!isDeptLeadOrAbove(user.role)) {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

/**
 * Permission-based guard. Resolves the user's effective permission for
 * (module, action) — Owner short-circuits to true, otherwise we consult
 * any overrides on top of the role default. Throws if denied.
 *
 * Use this at the entry of any sensitive server action where the gate is
 * fine-grained (e.g. "approve a submission"). Role-tier guards above remain
 * appropriate for coarse gates ("only managers can approve users").
 */
export async function requirePermission(
  module: Module,
  action: Action
): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (user.role === "admin") return user;
  const overrides = await getUserOverrides(user.id);
  if (!checkPermission(user, module, action, overrides)) {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Backwards-compat aliases — keep existing call sites working while the
// codebase migrates to the new vocabulary. New code should prefer the
// explicit helpers above.
// ---------------------------------------------------------------------------

/** @deprecated Use requireOwner — admin is the legacy name for the owner tier. */
export const requireAdmin = requireOwner;

/** @deprecated Use requireManagerOrAbove — old name kept for existing callers. */
export const requireManagerOrAdmin = requireManagerOrAbove;

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `types/next-auth.d.ts`

<a id="types-next-auth-d-ts"></a>

```typescript
import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      department: string | null;
      active: boolean;
      approved: boolean; // approvedAt is not null
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    department?: string | null;
    active?: boolean;
    approved?: boolean;
  }
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `auth.ts`

<a id="auth-ts"></a>

```typescript
// Full Auth.js config — used by API handlers, server components, and server actions.
// Phase 2: reads users from Prisma (app.db) instead of auth.db.
//
// Sign-in policy: the system is self-service.
// - Any Google account can sign in.
// - First-time sign-in auto-creates a User row with active=false, approvedAt=null,
//   role="employee". The admin then approves them from /admin/users.
// - Subsequent sign-ins always succeed; the layout gates page access for unapproved
//   or deactivated users.

import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { prisma } from "@/lib/db/prisma";
import { findUserByEmail, touchLogin } from "@/lib/db/users";
import type { Role } from "@/lib/auth/roles";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email) return false;
      const email = profile.email.trim().toLowerCase();
      let user = await findUserByEmail(email);

      if (!user) {
        // Bootstrap: the very first sign-in by ADMIN_EMAIL (when no admin exists yet)
        // auto-creates that user as an active admin. This lets a freshly deployed
        // instance be initialized without any manual DB seeding.
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const adminCount = await prisma.user.count({
          where: { role: "admin", active: true },
        });
        const shouldBeAdmin =
          !!adminEmail && email === adminEmail && adminCount === 0;

        user = await prisma.user.create({
          data: {
            email,
            name:
              (profile.name as string | undefined)?.trim() ||
              process.env.ADMIN_NAME?.trim() ||
              email.split("@")[0],
            role: shouldBeAdmin ? "admin" : "employee",
            active: shouldBeAdmin,
            approvedAt: shouldBeAdmin ? new Date() : null,
          },
        });
      }

      // Always allow sign-in to succeed — the layout will render a "pending approval"
      // gate for users whose account is not active yet. This lets the admin see them
      // in the pending queue after they've attempted to log in.
      await touchLogin(user.id);
      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const user = await findUserByEmail(token.email);
        if (user) {
          token.userId = user.id;
          token.role = user.role as Role;
          token.department = user.department;
          token.name = user.name;
          token.active = user.active;
          token.approved = !!user.approvedAt;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as Role) ?? "employee";
        session.user.department = (token.department as string | null) ?? null;
        session.user.active = (token.active as boolean | undefined) ?? false;
        session.user.approved = (token.approved as boolean | undefined) ?? false;
      }
      return session;
    },
  },
});

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `auth.config.ts`

<a id="auth-config-ts"></a>

```typescript
// Edge-safe Auth.js config used by proxy.ts (Next.js 16 middleware).
// No DB access here — better-sqlite3 is a native module and doesn't work at the edge.
//
// The full DB-backed jwt/session callbacks live in auth.ts; this file only maps
// what's already in the JWT onto req.auth.user so the proxy can do RBAC without
// a DB roundtrip.

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import type { Role } from "@/lib/auth/roles";

export default {
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as Role) ?? "employee";
        session.user.active = (token.active as boolean | undefined) ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `proxy.ts`

<a id="proxy-ts"></a>

```typescript
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
import { isManagerOrAbove, isOwner } from "@/lib/auth/roles";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/login", "/403"]);
const PUBLIC_PREFIXES = ["/api/auth"];

// Paths reserved for the OWNER (الرئيس) — president-only. The finance dashboard
// (totals + P&L), audit log, backups, theming, and the simulator control surface.
// The /admin/users page is now manager-accessible (handled below) so it is NOT
// in this list.
const OWNER_PREFIXES = [
  "/admin/audit",
  "/admin/backup",
  "/admin/theme",
  "/admin/permissions",
  "/api/admin",
  "/api/sim/control",
  "/api/sim/decide",
  "/api/sim/action",
];

// Paths the manager (المدير) can reach — and by inheritance, the owner.
// Currently: user approval + role assignment.
const MANAGER_PREFIXES = ["/admin/users"];

// API paths exempt from CSRF — Auth.js endpoints have their own CSRF guard.
const CSRF_EXEMPT_PREFIXES = ["/api/auth"];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function startsWithSegment(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

function isOwnerPath(path: string): boolean {
  return OWNER_PREFIXES.some((p) => startsWithSegment(path, p));
}

function isManagerPath(path: string): boolean {
  return MANAGER_PREFIXES.some((p) => startsWithSegment(path, p));
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

  // 2) RBAC — runs after auth so we know the role.
  //    a) Owner-only routes (finance API, audit, backup, theme, sim control)
  //    b) Manager-or-above routes (user approval / role assignment)
  if (isAuthed && isOwnerPath(path) && !isOwner(role)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/403";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthed && isManagerPath(path) && !isManagerOrAbove(role)) {
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

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `next.config.ts`

<a id="next-config-ts"></a>

```typescript
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP — strict by default; relaxes only what Next.js / Tailwind / Google fonts
// genuinely need. 'unsafe-inline' on style-src covers Next's inline <style> tags
// and Tailwind's runtime utilities. 'unsafe-eval' is dev-only for HMR.
//
// frame-src: needed because the photo-shoot detail page embeds the location
// as a Google Maps iframe. Without this entry the directive falls back to
// default-src 'self' and the map renders as a blocked-content placeholder.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  // Allow embedded Google Maps + YouTube. Both used by the shoots page (map)
  // and likely future surfaces (reference videos in shot lists).
  "frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com",
  // Worker scripts — service worker (push notifications) lives at /sw.js so
  // it loads from same-origin; this entry stops Next.js from blocking
  // worker registration in production builds.
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Allow requests through the Cloudflare quick tunnel in dev.
  // Tunnels give random *.trycloudflare.com subdomains, so we whitelist the whole suffix.
  allowedDevOrigins: ["*.trycloudflare.com"],

  // better-sqlite3 is a native (C++) module loaded at runtime — leave it
  // outside the bundler so Next.js doesn't try to inline its prebuilt binaries.
  // Without this the production build fails with "Cannot find module ../build/Release/better_sqlite3.node".
  serverExternalPackages: ["better-sqlite3"],

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `instrumentation.ts`

<a id="instrumentation-ts"></a>

```typescript
// Runs once when the Next.js server boots. We use it to start the smart backup
// scheduler — the only background process the app needs in real (Phase 2) mode.
//
// Restricted to `nodejs` runtime — the scheduler uses better-sqlite3 + setInterval
// which don't exist in the edge runtime.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip in build phase — Next runs `register()` once during `next build` to
  // collect telemetry, and we don't want to spawn timers from a build process.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Allow ops to disable the scheduler via env if they ever need to.
  if (process.env.SRB_DISABLE_AUTO_BACKUP === "1") {
    console.log("[instrumentation] auto backup disabled via SRB_DISABLE_AUTO_BACKUP");
    return;
  }

  // Seed the default skill badges if missing — idempotent.
  try {
    const { ensureDefaultBadges } = await import("./lib/db/badges");
    await ensureDefaultBadges();
  } catch (err) {
    console.error("[instrumentation] ensureDefaultBadges failed:", err);
  }

  // One-shot data migration — the deprecated `head` (رئيس جميع الأقسام)
  // role was removed in favour of a flat 4-tier hierarchy (admin / manager
  // / department_lead / employee). Any account still flagged as `head` is
  // promoted to `manager` so it keeps working with no manual intervention.
  // Idempotent: the WHERE clause matches zero rows once the migration has
  // run, so subsequent boots are no-ops.
  try {
    const { prisma } = await import("./lib/db/prisma");
    const migrated = await prisma.user.updateMany({
      where: { role: "head" },
      data: { role: "manager" },
    });
    if (migrated.count > 0) {
      console.log(
        `[instrumentation] migrated ${migrated.count} 'head' user(s) → 'manager'`
      );
    }
  } catch (err) {
    console.error("[instrumentation] head→manager migration failed:", err);
  }

  const { startScheduler } = await import("./lib/db/backup-scheduler");
  startScheduler();

  // Reminder scheduler — fires meeting / shoot / task / invoice alerts every
  // minute regardless of whether anyone has the page open. This is the
  // pipeline that delivers Web Push to phones.
  try {
    const { startReminderScheduler } = await import("./lib/reminders/scheduler");
    startReminderScheduler();
  } catch (err) {
    console.error("[instrumentation] reminder scheduler failed to start:", err);
  }
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `prisma/schema.prisma`

<a id="prisma-schema-prisma"></a>

```prisma
// SRB — Real company management system (Phase 2)
// Replaces the in-memory simulation with persistent SQLite storage.

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Login + role; mirrors the existing auth.db.authorized_users table,
// but owned by Prisma going forward (single source of truth).
//
// Role hierarchy (top → bottom), enforced by lib/auth/roles.ts:
//   admin           → الرئيس (Owner) — sees full finance, total control,
//                     access to PermissionOverride control panel
//   manager         → المدير (Admin) — approves users, assigns roles up to head,
//                     runs ops, no finance totals
//   head            → رئيس جميع الأقسام (Head of All Departments) — cross-dept
//                     visibility on projects/tasks/submissions; can edit, reassign
//                     and cancel any task across departments. No finance, no
//                     people-management, no system settings.
//   department_lead → رئيس قسم — manages their dept's projects, expenses, salaries, income
//   employee        → موظف — works on own tasks
model User {
  id          String    @id @default(cuid())
  email       String    @unique
  name        String
  role        String    @default("employee") // admin | manager | head | department_lead | employee
  department  String?
  active      Boolean   @default(true)
  // First-approval timestamp. null = pending admin approval (never approved yet).
  // Not-null = admin has approved this account (may still be toggled inactive later).
  approvedAt  DateTime?
  createdAt   DateTime  @default(now())
  lastLoginAt DateTime?

  // Employee profile
  jobTitle     String?
  phone        String?
  salaryQar    Float?
  hiredAt      DateTime?
  avatarUrl    String?

  // Relations
  tasksAssigned      Task[]             @relation("TaskAssignee")
  tasksCreated       Task[]             @relation("TaskCreator")
  taskCollaborations TaskCollaborator[]
  taskSubmissions    TaskSubmission[]   @relation("TaskSubmissionSubmitter")
  taskReviews        TaskSubmission[]   @relation("TaskSubmissionReviewer")
  comments           TaskComment[]
  updates            TaskUpdate[]
  memberships        ProjectMember[]
  leadsProjects      Project[]          @relation("ProjectLead")
  auditEntries       AuditLog[]         @relation("AuditActor")
  meetings           ClientMeeting[]    @relation("MeetingOwner")
  shootCrew          PhotoShootCrew[]
  heldEquipment      Equipment[]        @relation("EquipmentHolder")
  badges             UserBadge[]
  badgesAssigned     UserBadge[]        @relation("BadgeAssignedBy")
  notifications      Notification[]     @relation("NotificationRecipient")
  pushSubscriptions  PushSubscription[] @relation("PushSubscriptionUser")
  phaseSubmissions   ProjectPhase[]     @relation("PhaseSubmitter")
  phaseApprovals     ProjectPhase[]     @relation("PhaseApprover")
  permissionOverrides PermissionOverride[] @relation("PermissionOverrideUser")
  permissionGrants    PermissionOverride[] @relation("PermissionOverrideGrantedBy")
  briefApprovals     ProjectBrief[]     @relation("BriefApprover")
  assetsAdded        ProjectAsset[]     @relation("AssetAddedBy")
  deliveriesCreated  ClientDelivery[]   @relation("DeliveryCreatedBy")
  clientNotesAuthored ClientNote[]      @relation("ClientNoteAuthor")

  @@index([active])
  @@index([role])
}

// ---------------------------------------------------------------------------
// Creative brief — one record per project. Captures everything the creative
// team needs upfront so a designer / shooter / editor doesn't have to chase
// the account manager for context.
//
// Approval lifecycle: draft → pending_review → approved. Anyone with brief:edit
// can author / update; only brief:approve can flip to approved (which locks it
// from further edits unless the approver re-opens it).
// ---------------------------------------------------------------------------
model ProjectBrief {
  id              String   @id @default(cuid())
  projectId       String   @unique
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // The classic creative-brief fields. All optional so a partial brief is
  // still saveable and the team can fill in pieces as they're discovered.
  objective       String?  // الهدف من الحملة / المشروع
  targetAudience  String?  // الفئة المستهدفة
  styleNotes      String?  // الستايل والمزاج
  refs            String?  // روابط ومراجع (newline-separated)
  deliverables    String?  // المخرجات النهائية
  platforms       String?  // المنصات (Instagram, TikTok, ...)
  sizes           String?  // المقاسات والأبعاد
  notes           String?  // ملاحظات إضافية

  // Lifecycle
  approvalStage   String   @default("draft") // draft | pending_review | approved
  approvedById    String?
  approvedBy      User?    @relation("BriefApprover", fields: [approvedById], references: [id], onDelete: SetNull)
  approvedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([approvalStage])
}

// ---------------------------------------------------------------------------
// Project package tracker — what the agency promised the client (X posts,
// Y reels, Z shoots, ...) and how much of that has actually been delivered.
// 1-to-1 with Project. Counters are incremented manually by the project lead
// when a deliverable goes out — we don't try to auto-derive from tasks
// because the same task may produce 3 reels or 0, depending on scope.
// ---------------------------------------------------------------------------
model ProjectPackage {
  id        String  @id @default(cuid())
  projectId String  @unique
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Targets — what the package promised
  targetPosts   Int @default(0)
  targetReels   Int @default(0)
  targetVideos  Int @default(0)
  targetShoots  Int @default(0)
  targetStories Int @default(0)

  // Completed — what the team has actually shipped to the client
  completedPosts   Int @default(0)
  completedReels   Int @default(0)
  completedVideos  Int @default(0)
  completedShoots  Int @default(0)
  completedStories Int @default(0)

  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ---------------------------------------------------------------------------
// Project asset — single bucket for every visual reference, mood-board image,
// brand asset, and final deliverable that lives inside a project. The `kind`
// column splits them into UI lanes; the file/url fields work for both
// uploaded files (saved under /uploads via lib/uploads.ts) and external
// links (Drive, Figma, dribbble, ...).
// ---------------------------------------------------------------------------
model ProjectAsset {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // moodboard | reference | brand | deliverable | other
  kind        String   @default("moodboard")
  title       String?
  caption     String?

  // One of fileUrl / externalUrl is required at the application level.
  fileUrl     String?
  fileName    String?
  fileType    String?
  externalUrl String?

  addedById   String?
  addedBy     User?    @relation("AssetAddedBy", fields: [addedById], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())

  @@index([projectId, kind])
  @@index([projectId, createdAt])
}

// ---------------------------------------------------------------------------
// Client delivery — one row per individual deliverable handed to the client.
// Tracks the full lifecycle: drafting → sent → viewed → changes_requested
// (loops back to drafting) OR approved (terminal). Each transition is
// timestamped so we can answer "how long did the client take to approve?"
// and "how many revisions did this take?".
//
// This is INTERNAL tracking — the client doesn't sign in. The "viewed" and
// "approved" timestamps are flipped manually by the account manager based
// on what they hear from the client.
// ---------------------------------------------------------------------------
model ClientDelivery {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  title       String
  // post | reel | video | photo | other
  kind        String   @default("post")

  // drafting | sent | viewed | changes_requested | approved
  status      String   @default("drafting")

  deliveryUrl String?
  previewUrl  String?

  // Lifecycle timestamps. Each is set when status flips to that state.
  sentAt              DateTime?
  viewedAt            DateTime?
  changesRequestedAt  DateTime?
  approvedAt          DateTime?

  clientFeedback  String?
  notes           String?

  createdById String?
  createdBy   User?    @relation("DeliveryCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, status])
  @@index([projectId, createdAt])
}

// ---------------------------------------------------------------------------
// Permission overrides — the Owner can flip individual (module, action) pairs
// on a per-user basis, on top of the role default matrix in
// lib/auth/permissions.ts. `allowed=true` GRANTS a permission the role would
// not normally have; `allowed=false` REVOKES one the role would normally have.
// Absence of a row means "use role default". This lets the Owner build custom
// permission profiles without inventing new roles.
// ---------------------------------------------------------------------------
model PermissionOverride {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation("PermissionOverrideUser", fields: [userId], references: [id], onDelete: Cascade)
  // Module + action are stored as plain strings (TS union types in
  // lib/auth/permissions.ts are the source of truth). New modules added later
  // never require a DB migration.
  module      String
  action      String
  allowed     Boolean
  grantedById String?
  grantedBy   User?    @relation("PermissionOverrideGrantedBy", fields: [grantedById], references: [id], onDelete: SetNull)
  reason      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, module, action])
  @@index([userId])
}

// Skill / role badges that mark what a user is qualified to do.
// Replaces / augments the free-form jobTitle string with structured tags.
// Used by the smart task router to filter & rank candidates.
model Badge {
  id        String   @id @default(cuid())
  // Stable slug for code lookups (photographer, designer, sales, ...).
  slug      String   @unique
  labelAr   String
  labelEn   String
  // Single emoji (📸, 🎨) — keeps the UI dense without an icon font.
  icon      String   @default("⭐")
  colorHex  String   @default("#10b981")
  sortOrder Int      @default(0)
  // System badges are seeded at boot and shouldn't be deletable from the UI.
  // Custom badges (admin-created) are deletable.
  builtin   Boolean  @default(false)
  createdAt DateTime @default(now())

  users UserBadge[]

  @@index([sortOrder])
}

// Many-to-many between User and Badge with audit info on the assignment.
model UserBadge {
  userId       String
  badgeId      String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge        Badge    @relation(fields: [badgeId], references: [id], onDelete: Cascade)
  assignedAt   DateTime @default(now())
  assignedById String?
  assignedBy   User?    @relation("BadgeAssignedBy", fields: [assignedById], references: [id], onDelete: SetNull)

  @@id([userId, badgeId])
  @@index([badgeId])
  @@index([userId])
}

// ---------------------------------------------------------------------------
// Client (العميل) — the buyer side of the agency. One client can hold many
// projects (one-to-many via Project.clientId). Auto-created in
// app/projects/actions.ts when a project's clientName field is a new name —
// existing names re-use the row, so we never end up with duplicates from
// a typo in the project form.
//
// Indexes on name + phone keep the /clients search snappy at the
// 1k-row scale the system is sized for. Sorting on the list page is
// handled by joining latest project createdAt — see app/clients/page.tsx.
// ---------------------------------------------------------------------------
model Client {
  id        String    @id @default(cuid())
  name      String
  // Brand / company name — separate from `name` so a single client (e.g. an
  // agency contact "Mohammed Al-Kuwari") can hold multiple brand identities.
  // Auto-populated from the project form when a client is first linked to a
  // project that supplies a brand; never overwritten if already set.
  brandName String?
  email     String?
  phone     String?
  // Free-form textarea on the profile page (general notes about the client).
  // Distinct from the chronological `noteEntries` relation below, which logs
  // dated touchpoints with the user attribution and a separate row per entry.
  notes     String?
  createdAt DateTime  @default(now())
  // @default(now()) is required so `prisma db push` can backfill existing
  // rows when the column is added to a non-empty production database. Prisma
  // emits `DEFAULT CURRENT_TIMESTAMP` at the SQL level for SQLite, which the
  // ALTER TABLE ADD COLUMN step needs to satisfy NOT NULL on existing rows.
  // Without it, `db push` errors with "Added the required column updatedAt
  // ... without a default value" and the start script (db push && next start)
  // never reaches `next start`, taking the whole deploy down.
  updatedAt DateTime  @default(now()) @updatedAt
  projects  Project[]
  // Chronological touchpoint log — see ClientNote. Named `noteEntries` (not
  // `notes`) to avoid colliding with the free-form `notes` text field above.
  noteEntries ClientNote[]

  @@index([name])
  @@index([phone])
  @@index([brandName])
}

// ---------------------------------------------------------------------------
// Client touchpoint log — one row per "we talked to this client" entry.
// Lives on the client profile page as a chronological feed (newest first)
// so the team has a single source of truth for "when did we last reach out
// and what was said". Distinct from `Client.notes` (free-form general
// description that doesn't track time/author). Distinct from
// `ClientMeeting` (formal scheduled meetings with reminders / agenda).
// ---------------------------------------------------------------------------
model ClientNote {
  id        String   @id @default(cuid())
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  content   String
  createdAt DateTime @default(now())
  // Author. SetNull on delete so a deleted user doesn't take their notes
  // with them — the entry stays for the audit trail with author=null.
  createdById String?
  author      User?  @relation("ClientNoteAuthor", fields: [createdById], references: [id], onDelete: SetNull)

  @@index([clientId, createdAt])
  @@index([createdById])
}

model Project {
  id           String    @id @default(cuid())
  title        String
  description  String?
  clientId     String?
  client       Client?   @relation(fields: [clientId], references: [id], onDelete: SetNull)
  // Brand / company under which this project is delivered. May differ from
  // the client's display name (e.g. one agency contact owning multiple
  // brands). Synced into Client.brandName the first time a client gets a
  // brand assigned; subsequent project entries never overwrite the client's
  // existing brand — that's an explicit edit on the client profile.
  brandName    String?
  type         String? // video | photo | event | digital_campaign | web | design | branding | other
  status       String    @default("active") // active | on_hold | completed | cancelled
  priority     String    @default("normal") // low | normal | high | urgent
  budgetQar    Float     @default(0)
  startedAt    DateTime  @default(now())
  deadlineAt   DateTime?
  completedAt  DateTime?
  progressPct  Int       @default(0) // 0..100 — manual or computed from tasks
  // Billing type — one_time: budget is a single payment; monthly: budget is the recurring monthly amount.
  billingType  String    @default("one_time") // one_time | monthly
  // Monthly billing cycle length (days). Default 30 = every 30 days from the
  // cycle anchor. Overridable per-project so a client on a 15/45/60-day cycle fits.
  billingCycleDays Int    @default(30)
  // When the next invoice should go out. Set on create for monthly projects
  // (= startedAt + billingCycleDays) and advanced each time an invoice is recorded.
  // Null for one-time projects.
  nextInvoiceDueAt DateTime?
  // When the most recent invoice was collected — used for status badges and
  // to keep the "already paid this cycle?" check fast.
  lastInvoicedAt   DateTime?
  // Per-cycle reminder fire tracking. Reset to null when an invoice is recorded
  // (advancing to the next cycle) so a fresh set of reminders fires for it.
  invoiceReminderBeforeSentAt   DateTime?
  invoiceReminderDueSentAt      DateTime?
  invoiceReminderOverdueSentAt  DateTime?
  leadId       String?
  lead         User?     @relation("ProjectLead", fields: [leadId], references: [id], onDelete: SetNull)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  members      ProjectMember[]
  tasks        Task[]
  transactions Transaction[]
  shoots       PhotoShoot[]
  phases       ProjectPhase[]
  brief        ProjectBrief?
  package      ProjectPackage?
  assets       ProjectAsset[]
  deliveries   ClientDelivery[]
  freelancers  ProjectFreelancer[]

  @@index([status])
  @@index([clientId])
  @@index([leadId])
  @@index([deadlineAt])
  @@index([nextInvoiceDueAt])
}

// ---------------------------------------------------------------------------
// Project phases — ordered milestones inside a project. Each phase locks the
// next one until the owner approves its completion. Tasks may optionally
// belong to a phase (the field is nullable, so existing tasks are untouched).
// ---------------------------------------------------------------------------
model ProjectPhase {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  order       Int      @default(0)
  name        String
  description String?
  deadlineAt  DateTime?

  // Lifecycle:
  //   not_started → set on creation (except first phase, which starts active)
  //   active      → currently the working phase
  //   completed   → owner approved completion
  //   locked      → blocked until the previous phase is approved
  status      String   @default("locked")

  // Phase delivery — proof submitted by the employee + review state.
  proofLinkUrl   String?
  proofFileUrl   String?
  proofFileName  String?
  proofFileType  String?
  submittedAt    DateTime?
  submittedById  String?
  submittedBy    User?    @relation("PhaseSubmitter", fields: [submittedById], references: [id], onDelete: SetNull)

  reviewNotes    String?
  reviewedAt     DateTime?
  approvedById   String?
  approvedBy     User?    @relation("PhaseApprover", fields: [approvedById], references: [id], onDelete: SetNull)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tasks       Task[]   @relation("TaskPhase")

  @@index([projectId, order])
  @@index([projectId, status])
}

model ProjectMember {
  projectId String
  userId    String
  role      String? // lead | designer | developer | editor | account | sales | ...
  addedAt   DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([projectId, userId])
}

model Task {
  id             String    @id @default(cuid())
  projectId      String?
  project        Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  title          String
  description    String?
  status         String    @default("todo") // todo | in_progress | in_review | done | blocked
  priority       String    @default("normal") // low | normal | high | urgent
  assigneeId     String?
  assignee       User?     @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  creatorId      String
  creator        User      @relation("TaskCreator", fields: [creatorId], references: [id])
  dueAt          DateTime?
  startedAt      DateTime?
  completedAt    DateTime?
  estimatedHours Float?
  actualHours    Float?
  order          Int       @default(0) // for Kanban column ordering
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Reminder fire tracking — fired by /api/tasks/upcoming poller (1 hour before
  // dueAt) and /api/tasks/overdue (when dueAt has passed but the task is still
  // open AND project.deadlineAt has NOT yet passed — i.e. the slack window where
  // a task is late but the project can still be saved). Reset to null when
  // dueAt is rescheduled forward so a fresh reminder fires for the new window.
  reminderBeforeSentAt  DateTime?
  reminderOverdueSentAt DateTime?

  // Optional phase membership — when set, this task counts toward the
  // phase's progress bar and gates phase completion. Existing tasks remain
  // unaffected because the field is optional.
  phaseId String?
  phase   ProjectPhase? @relation("TaskPhase", fields: [phaseId], references: [id], onDelete: SetNull)

  // ------------------------------------------------------------------------
  // Latest work-delivery snapshot — flat fields on the Task itself so the
  // kanban / mobile UI can read the current submission without joining the
  // history table. Updated each time the assignee submits work; cleared when
  // the owner approves (status flips to done) or asks for changes.
  // The full audit trail of every submission still lives in TaskSubmission.
  // ------------------------------------------------------------------------
  submissionUrl       String?
  submissionFileUrl   String?
  submissionFileName  String?
  submissionFileType  String?
  submissionNote      String?
  submittedAt         DateTime?
  reviewNote          String?   // owner's reason when requesting changes
  reviewedAt          DateTime?

  comments      TaskComment[]
  updates       TaskUpdate[]
  collaborators TaskCollaborator[]
  submissions   TaskSubmission[]

  @@index([projectId])
  @@index([assigneeId])
  @@index([creatorId])
  @@index([status])
  @@index([dueAt])
  @@index([assigneeId, status])
  @@index([phaseId])
}

// ---------------------------------------------------------------------------
// Task work delivery — when an assignee submits work for review, we keep a
// row per submission so the history (link, attached file, owner notes) is
// preserved even after a "request changes" round-trip.
// ---------------------------------------------------------------------------
model TaskSubmission {
  id          String   @id @default(cuid())
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  submitterId String
  submitter   User     @relation("TaskSubmissionSubmitter", fields: [submitterId], references: [id], onDelete: Cascade)

  linkUrl     String?
  fileUrl     String?
  fileName    String?
  fileType    String?
  fileSize    Int?
  note        String?

  // pending | approved | changes_requested
  status      String   @default("pending")

  // Revision number — 1 for the first submission on a task, increments by
  // 1 each time the assignee re-submits after a "request changes" round.
  // Computed at insert time by counting prior submissions on the same task.
  revisionNumber Int     @default(1)

  reviewerId  String?
  reviewer    User?    @relation("TaskSubmissionReviewer", fields: [reviewerId], references: [id], onDelete: SetNull)
  reviewNotes String?
  reviewedAt  DateTime?

  createdAt   DateTime @default(now())

  @@index([taskId, createdAt])
  @@index([submitterId])
  @@index([status])
}

// Secondary assignees on a task — beyond the primary assignee.
// Used for tasks that multiple people work on together.
model TaskCollaborator {
  taskId  String
  userId  String
  task    Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  addedAt DateTime @default(now())

  @@id([taskId, userId])
}

model TaskComment {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now())

  @@index([taskId])
  @@index([authorId])
}

model TaskUpdate {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  actorId   String
  actor     User     @relation(fields: [actorId], references: [id])
  type      String // created | status_change | assignee_change | priority_change | due_change
  fromValue String?
  toValue   String?
  createdAt DateTime @default(now())

  @@index([taskId])
  @@index([actorId])
}

// Manual-entry accounting ledger.
model Transaction {
  id          String    @id @default(cuid())
  projectId   String?
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  kind        String // income | expense
  category    String // project_payment | salary | bonus | tool | ad | overhead | refund | freelance | other
  amountQar   Float // always positive; sign comes from kind
  description String?
  occurredAt  DateTime
  // Recurrence — none: one-time; monthly: recurring every month starting occurredAt until recurrenceEndsAt (or forever).
  recurrence       String    @default("none") // none | monthly
  recurrenceEndsAt DateTime?
  // Optional link to a per-project freelancer. When set, the transaction
  // counts toward the freelancer's "paid so far" total. Always paired with
  // category = "freelance" and a non-null projectId, but enforced at the
  // application level so legacy rows continue to work.
  freelancerId String?
  freelancer   ProjectFreelancer? @relation(fields: [freelancerId], references: [id], onDelete: SetNull)
  createdAt        DateTime  @default(now())
  createdById      String?

  @@index([occurredAt])
  @@index([projectId])
  @@index([kind])
  @@index([recurrence])
  @@index([freelancerId])
}

// ---------------------------------------------------------------------------
// Project freelancer — per-project contractor (photographer, designer,
// videographer, ...) hired for THIS project only. Their salary is paid out
// of the project budget, not the company payroll. Linked to Transaction so
// the project profit widget automatically subtracts every payment.
//
// Why a dedicated model instead of just expense rows:
//   1. Track the AGREED total separately from PAID-so-far (compute remaining)
//   2. One stable identity ("Ahmed the photographer") that survives multiple
//      payment instalments
//   3. Keep their phone / WhatsApp on file without bloating the User table
//   4. Future-proof for "history of freelancers we've used" reports
// ---------------------------------------------------------------------------
model ProjectFreelancer {
  id        String  @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  name  String
  // Free-form role label. We seed common roles client-side (مصور، ديزاينر،
  // مونتير، صوت، ...) but allow custom because every project may need a
  // different specialty.
  role  String  @default("photographer")
  phone String?
  email String?

  // What the freelancer was promised. The "paid so far" total is computed
  // live from Transaction rows linked via freelancerId.
  agreedAmountQar Float   @default(0)
  // Free-text payment terms ("50% upfront, 50% on delivery", "monthly", ...).
  paymentTerms    String?

  // active | completed | cancelled. Doesn't delete payment history when set
  // to cancelled — only hides the freelancer from the active list.
  status String @default("active")

  notes String?

  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  payments Transaction[]

  @@index([projectId, status])
}

// System-level settings (single row).
model AppSetting {
  id                Int     @id @default(1)
  companyName       String  @default("SRB")
  defaultCurrency   String  @default("QAR")
  fiscalYearStart   Int     @default(1) // month 1 = January
  notificationsOn   Boolean @default(true)
  simulationEnabled Boolean @default(false) // kept off

  // Theme — admin can customize branding colors (CSS variables).
  brandColor  String @default("#10b981") // emerald-500
  accentColor String @default("#0ea5e9") // sky-500
  logoPath    String @default("/srb-logo-white.png") // path under public/ (white-on-transparent PNG)
}

// Tamper-resistant admin action trail. Every sensitive mutation writes one row
// so you can answer "who approved this user", "when was that salary changed", etc.
model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  actor      User?    @relation("AuditActor", fields: [actorId], references: [id], onDelete: SetNull)
  actorEmail String   // Snapshot — survives if actor is deleted
  action     String   // e.g. "user.approve", "user.deactivate", "user.role_change", "tx.delete"
  targetType String?  // e.g. "user", "project", "task", "transaction"
  targetId   String?
  targetLabel String? // Human-readable target ("هادي · hadi.233363@gmail.com")
  metadata   String?  // JSON string with extra details (before/after values, reason)
  createdAt  DateTime @default(now())

  @@index([createdAt])
  @@index([actorId])
  @@index([action])
  @@index([targetType, targetId])
}

// Client meetings — intake requests + pitch calls + check-ins with clients.
// Tracks the full lifecycle: scheduled → (reminder fired) → done | cancelled | no_show.
model ClientMeeting {
  id          String   @id @default(cuid())
  clientName  String   // اسم العميل / الشخص المسؤول
  companyName String?  // اسم الشركة (اختياري)
  phone       String?
  email       String?

  // Client's digital footprint (so the team opens & reviews before the meeting)
  instagramHandle String? // @handle or full URL — both accepted
  tiktokHandle    String?
  websiteUrl      String?
  socialNotes     String? // Free-form: "also on snapchat, 500K followers"

  // Meeting logistics
  meetingAt    DateTime
  durationMin  Int       @default(60)
  location     String?   // "Office" | "Client site" | physical address | "Online"
  meetingLink  String?   // Zoom / Google Meet / Teams URL
  agendaNotes  String?   // Pre-meeting prep: what to discuss / goals

  // Lifecycle
  status       String    @default("scheduled") // scheduled | done | cancelled | no_show
  outcomeNotes String?   // Post-meeting: what was agreed, next steps

  // Assignment
  ownerId String?
  owner   User?   @relation("MeetingOwner", fields: [ownerId], references: [id], onDelete: SetNull)

  // Reminder tracking — set to the wall-clock time the "1h before" alert fired.
  // Null means the reminder hasn't gone out yet.
  reminderSentAt DateTime?

  // Audit
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?

  @@index([meetingAt])
  @@index([status])
  @@index([ownerId])
  @@index([status, meetingAt])
}

// ---------------------------------------------------------------------------
// Photography production system
// ---------------------------------------------------------------------------
// A PhotoShoot is the on-location production day for a project. It pins down
// the WHO (crew), WHEN (shootDate + duration), WHERE (location + map), and
// WHAT (equipment reservations + shot list). Crew members are employees —
// this is internal-facing, unlike ClientMeeting which is about the buyer.

model PhotoShoot {
  id            String  @id @default(cuid())
  title         String
  projectId     String?
  project       Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  // Timing
  shootDate     DateTime
  durationHours Float    @default(4)

  // Location
  location      String
  locationNotes String?  // floor, landmarks, entry instructions
  mapUrl        String?  // Google Maps / Apple Maps link

  // Logistics
  clientContact String?  // who to call on site
  shotList      String?  // freeform brief / checklist
  referenceUrl  String?  // moodboard / Drive link

  // Lifecycle
  status        String   @default("scheduled") // scheduled | done | cancelled | postponed
  notes         String?

  // Notification tracking — we fire 24h-before AND 1h-before alerts.
  reminderDayBeforeSentAt DateTime?
  reminderHourBeforeSentAt DateTime?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  createdById   String?

  crew          PhotoShootCrew[]
  equipment     PhotoShootEquipment[]

  @@index([shootDate])
  @@index([projectId])
  @@index([status])
  @@index([status, shootDate])
}

// Crew member assigned to a shoot. One user can be on many shoots; one shoot
// has many users.
model PhotoShootCrew {
  shootId String
  userId  String
  role    String?  // "photographer" | "videographer" | "assistant" | "director" | custom
  shoot   PhotoShoot @relation(fields: [shootId], references: [id], onDelete: Cascade)
  user    User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  addedAt DateTime @default(now())

  @@id([shootId, userId])
  @@index([userId])
}

// Equipment reserved for a shoot. We use this both to plan ("what are we taking")
// and to detect conflicts ("this lens is already booked that day").
model PhotoShootEquipment {
  shootId     String
  equipmentId String
  shoot       PhotoShoot @relation(fields: [shootId], references: [id], onDelete: Cascade)
  equipment   Equipment  @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  addedAt     DateTime @default(now())

  @@id([shootId, equipmentId])
  @@index([equipmentId])
}

// ---------------------------------------------------------------------------
// Equipment inventory — the agency's physical gear.
// ---------------------------------------------------------------------------
model Equipment {
  id           String   @id @default(cuid())
  name         String   // "Sony A7 IV" / "Sigma 24-70 f/2.8" / "Aputure 300D"
  category     String   // camera | lens | light | tripod | microphone | drone | audio | storage | accessory | other
  brand        String?
  model        String?
  serialNumber String?
  purchasedAt  DateTime?
  purchasePriceQar Float?

  condition    String   @default("good") // new | good | fair | needs_repair | broken
  notes        String?
  photoUrl     String?

  // Current holder — who physically has this gear right now.
  // Null = in office / storage.
  currentHolderId String?
  currentHolder   User?   @relation("EquipmentHolder", fields: [currentHolderId], references: [id], onDelete: SetNull)
  assignedAt      DateTime?
  expectedReturnAt DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  shootReservations PhotoShootEquipment[]

  @@index([category])
  @@index([condition])
  @@index([currentHolderId])
}

// Per-user notification inbox. Powers the bell icon in the topbar and the
// /notifications page. Used for: task-deadline alerts, role/permission changes,
// project assignments, mentions in comments, financial threshold warnings (owner
// only), and any event the system wants to deliver to a specific user.
//
// Reminders that fire as desktop notifications (meetings, shoots, invoices)
// also write a Notification row so the user has a permanent record they can
// review later from any device.
model Notification {
  id          String   @id @default(cuid())
  recipientId String
  recipient   User     @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)

  // Type slug — drives the icon, color and click target. Examples:
  //   task.due_soon, task.overdue, task.assigned, task.commented
  //   project.assigned, project.deadline_soon, project.completed
  //   meeting.soon, shoot.soon, invoice.due
  //   user.approved, user.role_changed
  //   finance.threshold (owner only)
  //   system.info
  kind     String
  // Severity — drives color in the bell. info = neutral, success = green,
  // warning = amber, danger = red.
  severity String   @default("info") // info | success | warning | danger

  // Short title (one line). Stored already-localized in the user's language at
  // creation time — keeping it simple. We can switch to i18n keys later.
  title    String
  // Optional longer body shown in the inbox panel.
  body     String?
  // Optional link the bell should navigate to when clicked.
  linkUrl  String?

  // Reference fields — let the inbox dedupe and the click handler open the
  // right entity. Loose pointers (no FK) so deleting a project doesn't cascade
  // away the notification — past notifications stay readable.
  refType String? // task | project | meeting | shoot | transaction | user
  refId   String?

  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([recipientId, createdAt])
  @@index([recipientId, readAt])
  @@index([refType, refId])
}

// Web Push subscription — one row per (user, browser/device). Stores the
// endpoint the browser gave us when the user clicked "Enable notifications".
// We hit that endpoint via the web-push library to deliver an alert that the
// browser displays even when the SRB tab is closed (or the phone is locked,
// for installed PWAs).
//
// One user may have many subscriptions (phone + laptop + work PC). When a
// subscription expires (HTTP 410 GONE), we delete the row.
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation("PushSubscriptionUser", fields: [userId], references: [id], onDelete: Cascade)

  // Push service endpoint — unique per device. Used as the dedupe key.
  endpoint  String   @unique

  // Auth + p256dh keys returned by the browser at subscribe time. Required
  // to encrypt the payload so only this device can read it.
  p256dh    String
  auth      String

  // Free-form label to help the user identify this device when they want
  // to revoke it ("iPhone of Hadi", "Office laptop").
  userAgent String?

  // Last successful push delivery — used to age out stale subs and to show
  // a "recently active" badge in the device-list UI.
  lastUsedAt DateTime?

  createdAt DateTime @default(now())

  @@index([userId])
}

// Backup run history — records when backups happened and their size.
model BackupRun {
  id           String    @id @default(cuid())
  filePath     String
  sizeBytes    Int
  createdAt    DateTime  @default(now())
  trigger      String    // "manual" | "scheduled" | "auto"
  // Result of the run. "success" = file written but not yet verified.
  // "verified" = post-write integrity check passed. "failed" = error captured below.
  status       String    @default("success")
  errorMessage String?
  verifiedAt   DateTime?
  // Reason the auto-scheduler picked this moment (e.g. "6h elapsed", "5 new transactions").
  // Null for manual / cron-script runs.
  reason       String?

  @@index([createdAt])
  @@index([status])
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/layout.tsx`

<a id="app-layout-tsx"></a>

```typescript
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { TopbarReal } from "@/components/topbar-real";
import { PendingGate } from "@/components/pending-gate";
import { MeetingReminder } from "@/components/meeting-reminder";
import { InvoiceReminder } from "@/components/invoice-reminder";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SRB — Internal Management",
  description: "SRB internal management system",
  manifest: "/manifest.json",
  applicationName: "SRB",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SRB",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
  // viewportFit=cover tells iOS to render under the notch/safe-area so we can
  // position the hamburger + drawer correctly via env(safe-area-inset-*).
  viewportFit: "cover" as const,
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale, settings] = await Promise.all([
    auth(),
    getLocale(),
    prisma.appSetting.findUnique({ where: { id: 1 } }).catch(() => null),
  ]);
  const user = session?.user;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isActive = user?.active === true;

  const brand = settings?.brandColor ?? "#10b981";
  const accent = settings?.accentColor ?? "#0ea5e9";
  const themeStyle: CSSProperties = {
    "--color-brand": brand,
    "--color-brand-dim": hexToRgba(brand, 0.1),
    "--color-brand-border": hexToRgba(brand, 0.3),
    "--color-accent": accent,
    "--color-accent-dim": hexToRgba(accent, 0.1),
  } as CSSProperties;

  return (
    <html lang={locale} dir={dir} className={cairo.variable} style={themeStyle}>
      <body className="min-h-dvh bg-zinc-950 text-zinc-50 antialiased">
        <LocaleProvider locale={locale}>
          {user ? (
            isActive ? (
              <div className="flex min-h-dvh">
                <Sidebar
                  userRole={user.role}
                  userName={user.name ?? user.email ?? "User"}
                  userEmail={user.email ?? ""}
                  logoPath={settings?.logoPath ?? "/srb-logo-white.png"}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <TopbarReal />
                  {/*
                    Bottom-nav clearance: pad the main scrolling area so the
                    last item isn't trapped under the 64px bottom-nav on
                    mobile. md: removes the padding once the sidebar takes
                    over.
                  */}
                  <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
                    {children}
                  </main>
                </div>
                {/* Mobile bottom nav — visible <md only. */}
                <MobileBottomNav role={user.role} />
                {/* Background reminder pollers — fire desktop notifications. */}
                <MeetingReminder />
                <InvoiceReminder />
              </div>
            ) : (
              <PendingGate
                userName={user.name ?? user.email ?? "User"}
                userEmail={user.email ?? ""}
                wasPreviouslyApproved={user.approved === true}
              />
            )
          ) : (
            children
          )}
        </LocaleProvider>
      </body>
    </html>
  );
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `components/sidebar.tsx`

<a id="components-sidebar-tsx"></a>

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Home,
  Briefcase,
  Users,
  UserSquare,
  DollarSign,
  KanbanSquare,
  FileText,
  ShieldCheck,
  LogOut,
  Shield,
  Archive,
  Palette,
  Calendar,
  Camera,
  Package,
  Menu,
  X,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";
import {
  isDeptLeadOrAbove,
  isManagerOrAbove,
  isOwner,
  type Role,
} from "@/lib/auth/roles";

// Hide most of the local part of an email so the address can still be
// recognised by its owner without exposing it to anyone glancing at the screen.
//   "ahmed.ali@gmail.com"  → "a***@gmail.com"
//   "x@gmail.com"          → "x***@gmail.com"
//   "no-domain"            → "no-domain"   (untouched)
function maskEmail(email: string): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 1);
  return `${head}***${domain}`;
}

// minRole controls which tier can see a sidebar entry. We resolve it against
// the user's role via meets() — so e.g. minRole="manager" hides the entry from
// employees + dept_leads but shows it to managers and owners.
type MinRole = "owner" | "manager" | "dept_lead" | "any";

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof Home;
  highlight?: boolean;
  minRole?: MinRole;
}

const nav: NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: Home },
  { href: "/projects", labelKey: "nav.projects", icon: Briefcase, highlight: true },
  { href: "/tasks", labelKey: "nav.tasks", icon: KanbanSquare, highlight: true },
  { href: "/clients", labelKey: "nav.clients", icon: UserSquare },
  { href: "/team", labelKey: "nav.team", icon: Users },
  { href: "/meetings", labelKey: "nav.meetings", icon: Calendar, highlight: true },
  { href: "/shoots", labelKey: "nav.shoots", icon: Camera, highlight: true },
  { href: "/equipment", labelKey: "nav.equipment", icon: Package },
  // Finance: dept_lead and above can OPEN the page (to record transactions).
  // The owner-only totals view is enforced inside the page itself.
  { href: "/finance", labelKey: "nav.finance", icon: DollarSign, minRole: "dept_lead" },
  { href: "/reports", labelKey: "nav.reports", icon: FileText, minRole: "owner" },
  // User approval is now manager-accessible. Owner sees it too via inheritance.
  { href: "/admin/users", labelKey: "nav.admin_users", icon: ShieldCheck, minRole: "manager" },
  { href: "/admin/permissions", labelKey: "nav.admin_permissions", icon: KeyRound, minRole: "owner" },
  { href: "/admin/audit", labelKey: "nav.admin_audit", icon: Shield, minRole: "owner" },
  { href: "/admin/backup", labelKey: "nav.admin_backup", icon: Archive, minRole: "owner" },
  { href: "/admin/theme", labelKey: "nav.admin_theme", icon: Palette, minRole: "owner" },
];

function visibleTo(role: Role, min: MinRole | undefined): boolean {
  if (!min || min === "any") return true;
  if (min === "owner") return isOwner(role);
  if (min === "manager") return isManagerOrAbove(role);
  if (min === "dept_lead") return isDeptLeadOrAbove(role);
  return true;
}

interface Props {
  userRole: Role;
  userName: string;
  userEmail: string;
  logoPath?: string;
}

export function Sidebar({ userRole, userName, userEmail, logoPath }: Props) {
  const pathname = usePathname();
  const t = useT();
  const { locale } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close the mobile drawer when the user navigates.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Listen for the bottom-nav "More" button. We use a window-level custom
  // event so the bottom nav (a sibling component, not a parent) can trigger
  // the drawer without lifting state into a wrapper. Pairs with the
  // dispatcher in components/mobile-bottom-nav.tsx → MobileBottomNavMount.
  useEffect(() => {
    const onOpen = () => setMobileOpen(true);
    window.addEventListener("srb:open-mobile-nav", onOpen);
    return () => window.removeEventListener("srb:open-mobile-nav", onOpen);
  }, []);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const activeIndicatorClass =
    locale === "ar"
      ? "mr-auto h-1.5 w-1.5 rounded-full"
      : "ml-auto h-1.5 w-1.5 rounded-full";

  const panel = (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col gap-1 bg-zinc-900/95 p-4 md:bg-zinc-900/40",
        "md:relative md:h-auto md:translate-x-0 md:border-zinc-800 md:border-s",
        // Mobile: fixed drawer overlay
        "fixed inset-y-0 z-40 h-screen border-zinc-800 border-s transition-transform duration-200",
        locale === "ar" ? "right-0" : "left-0",
        mobileOpen
          ? "translate-x-0"
          : locale === "ar"
          ? "translate-x-full md:translate-x-0"
          : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-2 px-2 py-3 md:block">
        <div className="flex-1">
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "var(--color-brand-dim)" }}
          >
            <img
              src={logoPath || "/srb-logo-white.png"}
              alt="SRB"
              className="h-7 w-full object-contain object-center"
            />
          </div>
          <div className="mt-2 text-center text-[10px] text-zinc-500">
            {t("brand.system")}
          </div>
        </div>
        {/* Close button — mobile only. 44px min size meets iOS touch target guidance. */}
        <button
          onClick={() => setMobileOpen(false)}
          className="mt-2 flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {nav.map((item) => {
          if (!visibleTo(userRole, item.minRole)) return null;
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const isHighlight = "highlight" in item && item.highlight;

          const classes = cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
            active
              ? "bg-zinc-800/80 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
          );

          const highlightStyle =
            isHighlight && !active ? { color: "var(--color-brand)" } : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={classes}
              style={highlightStyle}
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.labelKey)}</span>
              {active && (
                <span
                  className={activeIndicatorClass}
                  style={{ background: "var(--color-brand)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-zinc-800 pt-3">
        <div className="mb-2 rounded-lg bg-zinc-800/40 p-2.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-zinc-200">
                {userName}
              </div>
              <div
                className="truncate text-[10px] text-zinc-500"
                dir="ltr"
                title={userEmail}
              >
                {maskEmail(userEmail)}
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px]",
                userRole === "admin"
                  ? "bg-rose-500/10 text-rose-400"
                  : userRole === "manager"
                  ? "bg-amber-500/10 text-amber-400"
                  : userRole === "department_lead"
                  ? "bg-sky-500/10 text-sky-400"
                  : "bg-emerald-500/10 text-emerald-400"
              )}
            >
              {t(`role.${userRole}`)}
            </span>
          </div>
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-700 py-1 text-[10px] text-zinc-400 transition hover:border-rose-500/30 hover:text-rose-400"
          >
            <LogOut className="h-3 w-3" />
            {t("auth.signout")}
          </button>
        </div>
        <div className="text-[10px] text-zinc-600">v1.0.0 · Phase 2 real</div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger — only shown below md. Safe-area-inset keeps the
          button below the iPhone Dynamic Island / notch. */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-200 shadow-lg md:hidden"
        style={{
          top: "max(12px, env(safe-area-inset-top))",
          ...(locale === "ar"
            ? { right: "max(12px, env(safe-area-inset-right))" }
            : { left: "max(12px, env(safe-area-inset-left))" }),
        }}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop — clicking closes the drawer */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-hidden
        />
      )}

      {panel}
    </>
  );
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `components/topbar-real.tsx`

<a id="components-topbar-real-tsx"></a>

```typescript
// Top bar for real-mode. Renders company name, date, and language switcher.

import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import { PushEnableButton } from "./push-enable-button";

export async function TopbarReal() {
  const [settings, locale] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: 1 } }),
    getLocale(),
  ]);
  const companyName = settings?.companyName ?? "SRB";
  const dateLocale = locale === "ar" ? "ar-QA" : "en-US";

  // On mobile the sidebar drawer is triggered by a fixed hamburger button that
  // sits in the top corner. Add horizontal padding matching the button size so
  // the topbar content doesn't slide under it.
  const mobilePadClass = locale === "ar" ? "pe-14 md:pe-6" : "ps-14 md:ps-6";

  return (
    <header
      className={`flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/30 pe-4 ps-4 py-3 md:pe-6 md:ps-6 ${mobilePadClass}`}
    >
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 text-emerald-400" />
        <span className="font-semibold text-zinc-100">{companyName}</span>
        <span className="hidden text-zinc-700 sm:inline">·</span>
        <span className="hidden text-zinc-500 sm:inline">
          {translate("brand.system", locale)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-[11px] text-zinc-500 md:block">
          {new Date().toLocaleDateString(dateLocale, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
        <PushEnableButton />
        <NotificationBell />
        <LanguageSwitcher />
      </div>
    </header>
  );
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/page.tsx`

<a id="app-page-tsx"></a>

```typescript
import Link from "next/link";
import {
  Briefcase,
  DollarSign,
  KanbanSquare,
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/cn";
import { getLocale } from "@/lib/i18n/server";
import { translate, type Locale } from "@/lib/i18n/dict";
import { BackupHealthWidget } from "@/components/backup-health-widget";
import { SmartInsightsPanel } from "@/components/smart-insights";
import { CreativeCommandCenter } from "@/components/creative-command-center";
import {
  isDeptLeadOrAbove,
  isManagerOrAbove,
  isOwner,
} from "@/lib/auth/roles";

const MS_30D = 30 * 24 * 60 * 60 * 1000;

export default async function OverviewPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const userName = session?.user?.name ?? t("overview.userFallback");
  const role = session?.user.role;
  // Money KPIs are owner-only — manager/dept_lead/employee never see them.
  const isAdmin = isOwner(role);
  const canManageUsers = isManagerOrAbove(role);
  const canRecordTx = isDeptLeadOrAbove(role);

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - MS_30D);

  // Non-admins don't see the money KPIs — skip those queries entirely.
  const [
    activeProjects,
    allTasks,
    openTasks,
    overdueTasks,
    teamSize,
    last30dIncome,
    last30dExpense,
    activeContractsAggregate,
  ] = await Promise.all([
    prisma.project.count({ where: { status: "active" } }),
    prisma.task.count(),
    prisma.task.count({
      where: { status: { in: ["todo", "in_progress", "in_review"] } },
    }),
    prisma.task.count({
      where: {
        status: { in: ["todo", "in_progress", "in_review"] },
        dueAt: { lt: now },
      },
    }),
    prisma.user.count({ where: { active: true } }),
    isAdmin
      ? prisma.transaction.aggregate({
          where: { kind: "income", occurredAt: { gte: thirtyAgo } },
          _sum: { amountQar: true },
        })
      : Promise.resolve({ _sum: { amountQar: 0 } as { amountQar: number | null } }),
    isAdmin
      ? prisma.transaction.aggregate({
          where: { kind: "expense", occurredAt: { gte: thirtyAgo } },
          _sum: { amountQar: true },
        })
      : Promise.resolve({ _sum: { amountQar: 0 } as { amountQar: number | null } }),
    // Active contracts value — sum of budgetQar across every project still in
    // `active` state. Computed live so a freshly added project bumps the
    // owner's portfolio number immediately, no transactions required. Owner-
    // only because budget data is sensitive pricing info.
    isAdmin
      ? prisma.project.aggregate({
          where: { status: "active" },
          _sum: { budgetQar: true },
        })
      : Promise.resolve({ _sum: { budgetQar: 0 } as { budgetQar: number | null } }),
  ]);

  const revenue = last30dIncome._sum.amountQar ?? 0;
  const expenses = last30dExpense._sum.amountQar ?? 0;
  const net = revenue - expenses;
  const activeContractsValue = activeContractsAggregate._sum.budgetQar ?? 0;
  const isEmpty = activeProjects === 0 && allTasks === 0 && teamSize <= 1;

  // ---------------------------------------------------------------------
  // Creative Command Center data — manager+ only. Owner and managers
  // share the same view; lower tiers don't see this panel because the
  // data spans every team.
  // ---------------------------------------------------------------------
  const showCommandCenter = isManagerOrAbove(role);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    urgentTaskRows,
    overdueTaskRows,
    upcomingShootRows,
    atRiskProjectRows,
  ] = showCommandCenter
    ? await Promise.all([
        prisma.task.findMany({
          where: {
            priority: "urgent",
            status: { in: ["todo", "in_progress", "in_review"] },
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 8,
          select: {
            id: true,
            title: true,
            dueAt: true,
            assignee: { select: { id: true, name: true } },
            project: { select: { id: true, title: true } },
          },
        }),
        prisma.task.findMany({
          where: {
            status: { in: ["todo", "in_progress", "in_review"] },
            dueAt: { lt: now },
          },
          orderBy: { dueAt: "asc" },
          take: 8,
          select: {
            id: true,
            title: true,
            dueAt: true,
            assignee: { select: { id: true, name: true } },
            project: { select: { id: true, title: true } },
          },
        }),
        prisma.photoShoot.findMany({
          where: {
            status: "scheduled",
            shootDate: { gte: now, lte: sevenDaysFromNow },
          },
          orderBy: { shootDate: "asc" },
          take: 8,
          select: {
            id: true,
            title: true,
            shootDate: true,
            location: true,
            status: true,
          },
        }),
        prisma.project.findMany({
          where: {
            status: "active",
            OR: [
              // Deadline within a week
              { deadlineAt: { gte: now, lte: sevenDaysFromNow } },
              // Deadline already passed but project still active
              { deadlineAt: { lt: now } },
            ],
          },
          orderBy: { deadlineAt: "asc" },
          take: 8,
          select: {
            id: true,
            title: true,
            deadlineAt: true,
            tasks: {
              where: {
                status: { in: ["todo", "in_progress", "in_review"] },
              },
              select: { id: true, dueAt: true },
            },
            brief: { select: { approvalStage: true } },
          },
        }),
      ])
    : [[], [], [], []];

  const overdueTasksWithDuration = overdueTaskRows.map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.dueAt,
    assignee: t.assignee,
    project: t.project,
    hoursOverdue: t.dueAt
      ? Math.max(0, (now.getTime() - t.dueAt.getTime()) / (60 * 60 * 1000))
      : 0,
  }));

  const atRiskWithCounts = atRiskProjectRows.map((p) => {
    const overdueTasks = p.tasks.filter(
      (t) => t.dueAt && t.dueAt.getTime() < now.getTime()
    ).length;
    const days = p.deadlineAt
      ? Math.ceil((p.deadlineAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    return {
      id: p.id,
      title: p.title,
      deadlineAt: p.deadlineAt,
      daysToDeadline: days,
      openTasks: p.tasks.length,
      overdueTasks,
      briefStage: p.brief?.approvalStage ?? "draft",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("page.overview.greeting")} {userName} 👋
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isEmpty
            ? t("page.overview.subtitleFresh")
            : t("page.overview.subtitle")}
        </p>
      </div>

      {/* KPI strip — money KPIs visible to admin only */}
      <div
        className={cn(
          "grid grid-cols-2 gap-4 sm:grid-cols-3",
          isAdmin ? "lg:grid-cols-7" : "lg:grid-cols-4"
        )}
      >
        <KpiCard
          label={t("kpi.activeProjects")}
          value={String(activeProjects)}
          icon={Briefcase}
        />
        <KpiCard
          label={t("kpi.openTasks")}
          value={String(openTasks)}
          sub={overdueTasks > 0 ? `${overdueTasks} ${t("tasks.overdue")}` : undefined}
          tone={overdueTasks > 0 ? "danger" : "default"}
          icon={KanbanSquare}
        />
        <KpiCard
          label={t("kpi.overdueTasks")}
          value={String(overdueTasks)}
          tone={overdueTasks > 0 ? "danger" : "default"}
          icon={KanbanSquare}
        />
        <KpiCard
          label={t("kpi.teamSize")}
          value={String(teamSize)}
          sub={t("common.activeEmployees")}
          icon={Users}
        />
        {isAdmin && (
          <>
            <KpiCard
              label={t("kpi.activeContracts")}
              value={formatQar(activeContractsValue, locale)}
              tone={activeContractsValue > 0 ? "positive" : "default"}
              sub={t("kpi.activeContractsSub")}
              icon={Briefcase}
            />
            <KpiCard
              label={t("kpi.revenue30")}
              value={formatQar(revenue, locale)}
              tone={revenue > 0 ? "positive" : "default"}
              icon={TrendingUp}
            />
            <KpiCard
              label={t("kpi.net30")}
              value={formatQar(net, locale, true)}
              tone={net > 0 ? "positive" : net < 0 ? "danger" : "default"}
              sub={`${t("common.expensesLabel")} ${formatQar(expenses, locale)}`}
              icon={DollarSign}
            />
          </>
        )}
      </div>

      {/* Smart Insights — visible to everyone but the content is role-aware
          (financial signals only show for owner). Computed server-side from
          live DB scans. */}
      <SmartInsightsPanel userRole={role} locale={locale} />

      {/* Creative Command Center — head+ only. Cross-department snapshot of
          the four risk vectors: urgent / overdue / upcoming shoots / at-risk
          projects. Hides itself when there's nothing to show. */}
      {showCommandCenter && (
        <CreativeCommandCenter
          urgentTasks={urgentTaskRows}
          overdueTasks={overdueTasksWithDuration}
          upcomingShoots={upcomingShootRows}
          atRiskProjects={atRiskWithCounts}
          locale={locale}
        />
      )}

      {isAdmin && <BackupHealthWidget locale={locale} />}

      {isEmpty && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              🚀
            </span>
            <h2 className="text-lg font-semibold text-zinc-100">
              {t("common.setupStart")}
            </h2>
          </div>
          <p className="mb-4 text-sm text-zinc-400">{t("common.setupDesc")}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SetupCard
              step={1}
              title={t("overview.setup.team.title")}
              description={t("overview.setup.team.desc")}
              href="/admin/users"
              cta={t("overview.setup.team.cta")}
              locale={locale}
            />
            <SetupCard
              step={2}
              title={t("overview.setup.project.title")}
              description={t("overview.setup.project.desc")}
              href="/projects"
              cta={t("overview.setup.project.cta")}
              locale={locale}
            />
            <SetupCard
              step={3}
              title={t("overview.setup.tasks.title")}
              description={t("overview.setup.tasks.desc")}
              href="/tasks"
              cta={t("overview.setup.tasks.cta")}
              locale={locale}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("common.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/projects" icon={Plus} label={t("action.newProject")} />
          <QuickAction href="/tasks" icon={Plus} label={t("action.newTask")} />
          {canRecordTx && (
            <QuickAction
              href="/finance"
              icon={DollarSign}
              label={t("action.recordTransaction")}
            />
          )}
          {canManageUsers && (
            <QuickAction
              href="/admin/users"
              icon={Users}
              label={t("action.addEmployee")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "danger"
      ? "text-rose-400"
      : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      <div className={cn("text-xl font-bold tabular-nums", toneClass)}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function SetupCard({
  step,
  title,
  description,
  href,
  cta,
  locale,
}: {
  step: number;
  title: string;
  description: string;
  href: string;
  cta: string;
  locale: Locale;
}) {
  const arrow = locale === "ar" ? "←" : "→";
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-900"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
          {step}
        </span>
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
      </div>
      <p className="text-[11px] text-zinc-500">{description}</p>
      <div className="mt-3 text-[11px] text-emerald-400 group-hover:text-emerald-300">
        {cta} {arrow}
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function formatQar(n: number, locale: Locale, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  const abs = Math.abs(Math.round(n));
  const currency = locale === "ar" ? "ر.ق" : "QAR";
  return `${n < 0 ? "−" : sign}${abs.toLocaleString("en")} ${currency}`;
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `components/smart-insights.tsx`

<a id="components-smart-insights-tsx"></a>

```typescript
// Server component — renders the Smart Insights panel on the home page.
// Wraps lib/insights/smart-insights.ts for the UI. Locale-aware: picks the
// AR / EN text from each insight at render time.

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { computeSmartInsights, type SmartInsight } from "@/lib/insights/smart-insights";
import type { Role } from "@/lib/auth/roles";
import type { Locale } from "@/lib/i18n/dict";
import { translate } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";

interface Props {
  userRole: Role | undefined;
  locale: Locale;
}

const SEVERITY_ICON: Record<SmartInsight["severity"], LucideIcon> = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: Lightbulb,
  success: TrendingUp,
};

const SEVERITY_BORDER: Record<SmartInsight["severity"], string> = {
  danger: "border-rose-500/30 hover:border-rose-500/60",
  warning: "border-amber-500/30 hover:border-amber-500/60",
  info: "border-sky-500/30 hover:border-sky-500/60",
  success: "border-emerald-500/30 hover:border-emerald-500/60",
};

const SEVERITY_TEXT: Record<SmartInsight["severity"], string> = {
  danger: "text-rose-400",
  warning: "text-amber-400",
  info: "text-sky-400",
  success: "text-emerald-400",
};

export async function SmartInsightsPanel({ userRole, locale }: Props) {
  const insights = await computeSmartInsights(userRole);

  const t = (key: string) => translate(key, locale);

  // Hide the panel entirely if nothing actionable — the home page shouldn't
  // have a giant "all clear" block when there's nothing to surface.
  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4">
        <div className="flex items-center gap-2 text-sm text-emerald-300">
          <Sparkles className="h-4 w-4" />
          <span className="font-semibold">{t("insights.allClear.title")}</span>
        </div>
        <p className="mt-1 text-xs text-emerald-300/70">{t("insights.allClear.desc")}</p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-fuchsia-400" />
        <h2 className="text-sm font-semibold text-zinc-300">
          {t("insights.heading")}
        </h2>
        <span className="text-[10px] text-zinc-600">{t("insights.subheading")}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {insights.map((ins) => {
          const Icon = SEVERITY_ICON[ins.severity];
          const title = locale === "ar" ? ins.titleAr : ins.titleEn;
          const detail = locale === "ar" ? ins.detailAr : ins.detailEn;
          const card = (
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-zinc-900/40 p-3.5 transition",
                SEVERITY_BORDER[ins.severity]
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-950",
                  SEVERITY_TEXT[ins.severity]
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-100">{title}</div>
                <div className="mt-0.5 text-[11px] text-zinc-500">{detail}</div>
              </div>
              {ins.href && (
                <ArrowRight
                  className={cn(
                    "mt-1 h-3.5 w-3.5 shrink-0 opacity-50",
                    locale === "ar" && "rotate-180"
                  )}
                />
              )}
            </div>
          );
          return ins.href ? (
            <Link key={ins.key} href={ins.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={ins.key}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `lib/insights/smart-insights.ts`

<a id="lib-insights-smart-insights-ts"></a>

```typescript
// Smart Insights — server-side rule engine that scans the live DB and
// surfaces patterns the team would otherwise have to dig for. Pure functions
// here, no UI; the home page renders the result.
//
// Signal categories:
//   • risk        — needs attention soon (overdue tasks with project slack)
//   • opportunity — positive trends worth amplifying
//   • alert       — owner-only financial conditions (low cash, expense spike)
//   • info        — neutral observations (workload balance, milestone close)
//
// Severity drives color in the UI: info < warning < danger.
//
// Each insight returns a stable `key` so the home page can map them to
// localized labels without us hardcoding Arabic / English here.

import { prisma } from "@/lib/db/prisma";
import type { Role } from "@/lib/auth/roles";
import { isOwner } from "@/lib/auth/roles";

export type InsightSeverity = "info" | "warning" | "danger" | "success";

export interface SmartInsight {
  key: string;            // stable id, e.g. "tasks.overdue_with_slack"
  severity: InsightSeverity;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  /** href the card should link to when clicked. */
  href?: string;
}

const MS_DAY = 24 * 60 * 60 * 1000;

export async function computeSmartInsights(
  userRole: Role | undefined
): Promise<SmartInsight[]> {
  const out: SmartInsight[] = [];
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * MS_DAY);

  // ─── 1. Tasks: overdue but project deadline still salvageable ────────────
  // The headline scenario the owner asked about: the TASK passed its dueAt
  // but the CLIENT delivery date is still in the future, so there's slack to
  // recover. We surface the count + the most overdue task so they can act.
  const overdueRecoverable = await prisma.task.findMany({
    where: {
      status: { in: ["todo", "in_progress", "in_review"] },
      dueAt: { lt: now },
      OR: [
        { projectId: null },
        { project: { deadlineAt: null } },
        { project: { deadlineAt: { gte: now } } },
      ],
    },
    orderBy: { dueAt: "asc" },
    take: 5,
    select: {
      id: true,
      title: true,
      dueAt: true,
      project: { select: { title: true, deadlineAt: true } },
    },
  });
  if (overdueRecoverable.length > 0) {
    const worst = overdueRecoverable[0];
    const lateDays = Math.ceil(
      (now.getTime() - (worst.dueAt?.getTime() ?? now.getTime())) / MS_DAY
    );
    out.push({
      key: "tasks.overdue_with_slack",
      severity: "danger",
      titleAr: `${overdueRecoverable.length} مهمة متأخرة لكن لسا في وقت للتسليم`,
      titleEn: `${overdueRecoverable.length} task(s) overdue but client deadline still safe`,
      detailAr: `أقدم مهمة: «${worst.title}» متأخرة ${lateDays} يوم${
        worst.project?.title ? ` · ${worst.project.title}` : ""
      }`,
      detailEn: `Oldest: "${worst.title}" — ${lateDays}d late${
        worst.project?.title ? ` · ${worst.project.title}` : ""
      }`,
      href: "/tasks",
    });
  }

  // ─── 2. Project deadlines closing in (next 7 days) ───────────────────────
  const closingProjects = await prisma.project.findMany({
    where: {
      status: "active",
      deadlineAt: { gte: now, lte: in7d },
    },
    orderBy: { deadlineAt: "asc" },
    take: 5,
    select: {
      id: true,
      title: true,
      deadlineAt: true,
      tasks: {
        where: { status: { in: ["todo", "in_progress", "in_review"] } },
        select: { id: true },
      },
    },
  });
  for (const p of closingProjects) {
    const remainDays = Math.ceil(
      ((p.deadlineAt?.getTime() ?? now.getTime()) - now.getTime()) / MS_DAY
    );
    const openCount = p.tasks.length;
    if (openCount > 0) {
      out.push({
        key: `project.deadline_close.${p.id}`,
        severity: remainDays <= 2 ? "danger" : "warning",
        titleAr: `${p.title} — التسليم خلال ${remainDays} يوم`,
        titleEn: `${p.title} — deadline in ${remainDays}d`,
        detailAr: `لسا في ${openCount} مهمة مفتوحة على المشروع`,
        detailEn: `${openCount} task(s) still open on this project`,
        href: `/projects/${p.id}`,
      });
    }
  }

  // ─── 3. Workload imbalance — flag any active employee with > 8 open tasks
  const overloaded = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          tasksAssigned: {
            where: { status: { in: ["todo", "in_progress", "in_review"] } },
          },
        },
      },
    },
  });
  const heaviest = overloaded
    .filter((u) => u._count.tasksAssigned > 8)
    .sort((a, b) => b._count.tasksAssigned - a._count.tasksAssigned);
  if (heaviest.length > 0) {
    const top = heaviest[0];
    out.push({
      key: "team.overloaded",
      severity: "warning",
      titleAr: `${heaviest.length} موظف عليه ضغط زايد`,
      titleEn: `${heaviest.length} teammate(s) overloaded`,
      detailAr: `الأعلى: ${top.name} (${top._count.tasksAssigned} مهمة)`,
      detailEn: `Top: ${top.name} (${top._count.tasksAssigned} open tasks)`,
      href: "/team",
    });
  }

  // ─── 4. Equipment due-back overdue ──────────────────────────────────────
  const equipmentLate = await prisma.equipment.findMany({
    where: {
      currentHolderId: { not: null },
      expectedReturnAt: { lt: now },
    },
    select: {
      id: true,
      name: true,
      expectedReturnAt: true,
      currentHolder: { select: { name: true } },
    },
    take: 5,
  });
  if (equipmentLate.length > 0) {
    const sample = equipmentLate[0];
    out.push({
      key: "equipment.return_overdue",
      severity: "warning",
      titleAr: `${equipmentLate.length} معدات لازم ترجع`,
      titleEn: `${equipmentLate.length} equipment items past due return`,
      detailAr: `${sample.name} مع ${sample.currentHolder?.name ?? "—"}`,
      detailEn: `${sample.name} with ${sample.currentHolder?.name ?? "—"}`,
      href: "/equipment",
    });
  }

  // ─── 5. Pending user approvals (manager-or-above only — they're the
  //       audience that can act on it) ──────────────────────────────────
  const pendingCount = await prisma.user.count({
    where: { approvedAt: null },
  });
  if (pendingCount > 0) {
    out.push({
      key: "users.pending_approval",
      severity: "info",
      titleAr: `${pendingCount} طلب انضمام للفريق ينتظر موافقة`,
      titleEn: `${pendingCount} team join request(s) awaiting approval`,
      detailAr: "افتح إدارة الحسابات وعطهم الصلاحية المناسبة",
      detailEn: "Open user management to assign their role",
      href: "/admin/users",
    });
  }

  // ─── 6. Owner-only financial signals ────────────────────────────────────
  if (isOwner(userRole)) {
    const since30 = new Date(now.getTime() - 30 * MS_DAY);
    const since60 = new Date(now.getTime() - 60 * MS_DAY);

    const [income30, expense30, income60, expense60] = await Promise.all([
      prisma.transaction.aggregate({
        where: { kind: "income", occurredAt: { gte: since30, lte: now } },
        _sum: { amountQar: true },
      }),
      prisma.transaction.aggregate({
        where: { kind: "expense", occurredAt: { gte: since30, lte: now } },
        _sum: { amountQar: true },
      }),
      prisma.transaction.aggregate({
        where: { kind: "income", occurredAt: { gte: since60, lt: since30 } },
        _sum: { amountQar: true },
      }),
      prisma.transaction.aggregate({
        where: { kind: "expense", occurredAt: { gte: since60, lt: since30 } },
        _sum: { amountQar: true },
      }),
    ]);

    const i30 = income30._sum.amountQar ?? 0;
    const e30 = expense30._sum.amountQar ?? 0;
    const i60 = income60._sum.amountQar ?? 0;
    const e60 = expense60._sum.amountQar ?? 0;

    // Cash burn — expenses materially outpace income for 30d
    if (e30 > i30 && e30 - i30 > 1000) {
      out.push({
        key: "finance.cash_burn",
        severity: "danger",
        titleAr: "المصاريف فاقت الإيرادات هذا الشهر",
        titleEn: "Expenses outpaced revenue last 30d",
        detailAr: `الفجوة: ${(e30 - i30).toLocaleString("en")} ر.ق`,
        detailEn: `Gap: ${(e30 - i30).toLocaleString("en")} QAR`,
        href: "/finance",
      });
    }

    // Revenue spike or drop month-over-month
    if (i60 > 0) {
      const change = ((i30 - i60) / i60) * 100;
      if (change <= -20) {
        out.push({
          key: "finance.revenue_drop",
          severity: "warning",
          titleAr: `الإيرادات هبطت ${Math.round(Math.abs(change))}% عن الشهر السابق`,
          titleEn: `Revenue dropped ${Math.round(Math.abs(change))}% MoM`,
          detailAr: `${i30.toLocaleString("en")} مقابل ${i60.toLocaleString("en")} ر.ق`,
          detailEn: `${i30.toLocaleString("en")} vs ${i60.toLocaleString("en")} QAR`,
          href: "/finance",
        });
      } else if (change >= 25) {
        out.push({
          key: "finance.revenue_spike",
          severity: "success",
          titleAr: `الإيرادات ارتفعت ${Math.round(change)}% عن الشهر السابق 🚀`,
          titleEn: `Revenue up ${Math.round(change)}% MoM 🚀`,
          detailAr: `${i30.toLocaleString("en")} مقابل ${i60.toLocaleString("en")} ر.ق`,
          detailEn: `${i30.toLocaleString("en")} vs ${i60.toLocaleString("en")} QAR`,
          href: "/finance",
        });
      }
    }

    // Expense spike — current 30d expenses well above prior 30d
    if (e60 > 0 && (e30 - e60) / e60 >= 0.3) {
      out.push({
        key: "finance.expense_spike",
        severity: "warning",
        titleAr: `المصاريف زادت ${Math.round(((e30 - e60) / e60) * 100)}% فجأة`,
        titleEn: `Expenses jumped ${Math.round(((e30 - e60) / e60) * 100)}%`,
        detailAr: `هذا الشهر: ${e30.toLocaleString("en")} · السابق: ${e60.toLocaleString(
          "en"
        )} ر.ق`,
        detailEn: `This 30d: ${e30.toLocaleString("en")} vs prior: ${e60.toLocaleString(
          "en"
        )} QAR`,
        href: "/finance",
      });
    }

    // Monthly recurring projects with stale invoices
    const overdueInvoices = await prisma.project.count({
      where: {
        billingType: "monthly",
        status: { in: ["active", "on_hold"] },
        nextInvoiceDueAt: { lt: now },
      },
    });
    if (overdueInvoices > 0) {
      out.push({
        key: "finance.invoices_overdue",
        severity: "warning",
        titleAr: `${overdueInvoices} فاتورة شهرية متأخرة`,
        titleEn: `${overdueInvoices} monthly invoice(s) overdue`,
        detailAr: "تابع التحصيل قبل ما يكبر الرقم",
        detailEn: "Chase collection before it grows",
        href: "/projects",
      });
    }
  }

  // Cap at 8 cards so the panel stays scannable.
  return out.slice(0, 8);
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/finance/page.tsx`

<a id="app-finance-page-tsx"></a>

```typescript
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import {
  AlertTriangle,
  DollarSign,
  Repeat,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { formatDate, formatQar } from "@/lib/db/helpers";
import { cn } from "@/lib/cn";
import {
  computeFinanceSummary,
  computeMonthlyBaseline,
  getPeriodRange,
  type Period,
} from "@/lib/db/finance-calc";
import { NewTransactionButton } from "./new-transaction-button";
import { DeleteTransactionButton } from "./delete-transaction-button";
import { PeriodSelector } from "./period-selector";
import { getLocale } from "@/lib/i18n/server";
import { translate, type Locale } from "@/lib/i18n/dict";
import { isDeptLeadOrAbove, isOwner } from "@/lib/auth/roles";

const VALID_PERIODS: Period[] = ["week", "month", "quarter", "year"];

export default async function FinancePage(props: {
  searchParams: Promise<{ period?: string }>;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  // Only the OWNER (الرئيس) sees totals, baseline, P&L and the full
  // transactions table. Manager + dept_lead can still RECORD transactions
  // (income / expense / salary) — they get the simplified entry view below.
  // Plain employees don't see the page at all.
  const role = session?.user.role;
  const isFinanceOwner = isOwner(role);
  const canRecord = isDeptLeadOrAbove(role);

  if (!canRecord) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("finance.employee.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("finance.locked.desc")}
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          {t("finance.locked.body")}
        </div>
      </div>
    );
  }

  const { period: periodRaw } = await props.searchParams;
  const period: Period = VALID_PERIODS.includes(periodRaw as Period)
    ? (periodRaw as Period)
    : "month";

  // Manager / dept_lead get the entry-only view: list of active projects to tag
  // their transactions, plus the "new transaction" button. We skip every
  // aggregation query so they never see totals leak through.
  if (!isFinanceOwner) {
    const activeProjectsForDropdown = await prisma.project.findMany({
      where: { status: { in: ["active", "on_hold"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("finance.employee.title")}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {t("finance.employee.subtitle")}
            </p>
          </div>
          <NewTransactionButton projects={activeProjectsForDropdown} />
        </div>
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          {t("finance.employee.cta")}
        </div>
      </div>
    );
  }

  const now = new Date();
  const range = getPeriodRange(period, now);
  const prevRangeEnd = new Date(range.start.getTime());

  const [transactions, allProjects, activeProjectsForDropdown] = await Promise.all([
    prisma.transaction.findMany({
      include: { project: { select: { id: true, title: true } } },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.project.findMany(),
    prisma.project.findMany({
      where: { status: { in: ["active", "on_hold"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const summary = computeFinanceSummary({
    transactions,
    projects: allProjects,
    period,
    now,
  });
  const prevSummary = computeFinanceSummary({
    transactions,
    projects: allProjects,
    period,
    now: prevRangeEnd,
  });
  const baseline = computeMonthlyBaseline({
    transactions,
    projects: allProjects,
    now,
  });

  const revenueDelta =
    prevSummary.totalIncome > 0
      ? ((summary.totalIncome - prevSummary.totalIncome) / prevSummary.totalIncome) * 100
      : 0;
  const expenseDelta =
    prevSummary.totalExpense > 0
      ? ((summary.totalExpense - prevSummary.totalExpense) / prevSummary.totalExpense) *
        100
      : 0;

  const risks = analyzeRisks(
    {
      totalIncome: summary.totalIncome,
      totalExpense: summary.totalExpense,
      net: summary.netProfit,
      prevIncome: prevSummary.totalIncome,
      prevExpense: prevSummary.totalExpense,
      transactionCount: transactions.length,
      monthlyExpenseBaseline: baseline.monthlyExpenseBaseline,
      monthlyIncomeBaseline: baseline.monthlyIncomeBaseline,
    },
    locale
  );

  // Localized period label for KPI titles
  const periodLabel = t(`finance.period.${period}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("page.finance.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.finance.subtitle")}
          </p>
        </div>
        <NewTransactionButton projects={activeProjectsForDropdown} />
      </div>

      {/* Period selector */}
      <PeriodSelector current={period} />

      {/* Monthly baseline (fixed commitments) */}
      <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-sky-400">
          <Repeat className="h-3.5 w-3.5" />
          {t("finance.commitments.title")}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <BaselineStat
            label={t("finance.commitments.income")}
            value={formatQar(baseline.monthlyIncomeBaseline, { locale })}
            sub={t("finance.commitments.incomeSub")}
            tone="positive"
          />
          <BaselineStat
            label={t("finance.commitments.expense")}
            value={formatQar(baseline.monthlyExpenseBaseline, { locale })}
            sub={t("finance.commitments.expenseSub")}
            tone="danger"
          />
          <BaselineStat
            label={t("finance.commitments.net")}
            value={formatQar(baseline.monthlyNetBaseline, { sign: true, locale })}
            sub={t("finance.commitments.netSub")}
            tone={baseline.monthlyNetBaseline >= 0 ? "positive" : "danger"}
          />
        </div>
      </div>

      {/* KPI strip for current period */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={`${t("finance.revenueLabel")} (${periodLabel})`}
          value={formatQar(summary.totalIncome, { locale })}
          delta={revenueDelta}
          icon={TrendingUp}
          tone="positive"
          deltaSuffix={t("finance.deltaVsPrev")}
          subtext={
            summary.projectMonthlyIncome > 0
              ? `${t("finance.ofWhich")} ${formatQar(summary.projectMonthlyIncome, {
                  locale,
                })} ${t("finance.fromMonthlyProjects")}`
              : undefined
          }
        />
        <KpiCard
          label={`${t("finance.expensesLabel")} (${periodLabel})`}
          value={formatQar(summary.totalExpense, { locale })}
          delta={expenseDelta}
          invertDelta
          icon={TrendingDown}
          deltaSuffix={t("finance.deltaVsPrev")}
          subtext={
            summary.recurringExpense > 0
              ? `${t("finance.ofWhich")} ${formatQar(summary.recurringExpense, {
                  locale,
                })} ${t("finance.recurring")}`
              : undefined
          }
        />
        <KpiCard
          label={t("finance.netProfit")}
          value={formatQar(summary.netProfit, { sign: true, locale })}
          subtext={`${t("finance.marginLabel")} ${summary.marginPct.toFixed(1)}%`}
          icon={Wallet}
          tone={summary.netProfit >= 0 ? "positive" : "danger"}
          deltaSuffix={t("finance.deltaVsPrev")}
        />
        <KpiCard
          label={t("finance.txCount")}
          value={String(transactions.length)}
          subtext={t("finance.inSystem")}
          icon={DollarSign}
          deltaSuffix={t("finance.deltaVsPrev")}
        />
      </div>

      {/* Upcoming one-time transactions callout */}
      {summary.upcomingOneTimeCount > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-amber-300">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {summary.upcomingOneTimeCount} {t("finance.upcomingCalloutSuffix")} (
            {formatQar(summary.upcomingOneTimeAmount, { locale })})
          </div>
          <div className="text-xs opacity-90">
            {t("finance.upcomingHint")}{" "}
            <span className="font-semibold">{t("finance.upcomingHintMark")}</span>{" "}
            {t("finance.upcomingHintTail")}
          </div>
        </div>
      )}

      {/* Risk analysis */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400">
            {t("finance.riskTitle")}
          </h2>
          {risks.map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm",
                r.severity === "danger"
                  ? "border-rose-500/40 bg-rose-500/5 text-rose-300"
                  : r.severity === "warn"
                  ? "border-amber-500/40 bg-amber-500/5 text-amber-300"
                  : "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
              )}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">{r.title}</div>
                <div className="mt-0.5 text-xs opacity-90">{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Monthly projects callout */}
      {summary.monthlyProjectIncome > 0 && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
            {t("finance.monthlyProjects.heading")}
          </div>
          <ul className="space-y-1.5 text-sm">
            {allProjects
              .filter(
                (p) =>
                  p.billingType === "monthly" &&
                  (p.status === "active" || p.status === "on_hold")
              )
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md bg-zinc-950/40 px-3 py-1.5"
                >
                  <span className="truncate text-zinc-300">{p.title}</span>
                  <span className="tabular-nums text-emerald-400">
                    {formatQar(p.budgetQar, { locale })}
                    {t("finance.monthlyProjects.perMonth")}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Transactions list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("finance.transactionsHeading")}
        </h2>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <DollarSign className="h-10 w-10 text-zinc-700" />
            <div className="text-sm text-zinc-400">{t("finance.empty.title")}</div>
            <p className="max-w-md text-xs text-zinc-500">
              {t("finance.empty.descFull")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-start font-normal">{t("table.date")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.type")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.category")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.recurrence")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.description")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.project")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.amount")}</th>
                  <th className="w-10 px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {transactions.map((tx) => {
                  const isIncome = tx.kind === "income";
                  const isRecurring = tx.recurrence === "monthly";
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-2 text-xs text-zinc-400 tabular-nums">
                        {formatDate(tx.occurredAt, locale)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px]",
                            isIncome
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          )}
                        >
                          {isIncome ? t("tx.income") : t("tx.expense")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-400">
                        {t(`txCategory.${tx.category}`)}
                      </td>
                      <td className="px-4 py-2">
                        {isRecurring ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
                            <Repeat className="h-2.5 w-2.5" />
                            {t("recurrence.monthly")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-600">
                            {t("recurrence.none")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-300">
                        {tx.description ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-sky-400">
                        {tx.project?.title ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-sm font-semibold tabular-nums",
                          isIncome ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {isIncome ? "+" : "−"}
                        {tx.amountQar.toLocaleString("en")} {locale === "en" ? "QAR" : "ر.ق"}
                        {isRecurring && (
                          <span className="mx-1 text-[10px] opacity-70">
                            {t("finance.monthlyProjects.perMonth")}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <DeleteTransactionButton id={tx.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  invertDelta,
  subtext,
  icon: Icon,
  tone = "default",
  deltaSuffix,
}: {
  label: string;
  value: string;
  delta?: number;
  invertDelta?: boolean;
  subtext?: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "danger";
  deltaSuffix: string;
}) {
  const valueTone =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "danger"
      ? "text-rose-400"
      : "text-zinc-100";

  let deltaTone = "text-zinc-500";
  if (delta !== undefined && delta !== 0) {
    const good = invertDelta ? delta < 0 : delta > 0;
    deltaTone = good ? "text-emerald-400" : "text-rose-400";
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      <div className={cn("mt-1.5 text-xl font-bold tabular-nums", valueTone)}>
        {value}
      </div>
      {delta !== undefined && delta !== 0 && (
        <div className={cn("text-[10px] tabular-nums", deltaTone)}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}% {deltaSuffix}
        </div>
      )}
      {subtext && <div className="text-[10px] text-zinc-600">{subtext}</div>}
    </div>
  );
}

function BaselineStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "positive" | "danger" | "default";
}) {
  const valueTone =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "danger"
      ? "text-rose-400"
      : "text-zinc-100";
  return (
    <div>
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-lg font-bold tabular-nums", valueTone)}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-600">{sub}</div>}
    </div>
  );
}

interface Risk {
  severity: "ok" | "warn" | "danger";
  title: string;
  detail: string;
}

function analyzeRisks(
  stats: {
    totalIncome: number;
    totalExpense: number;
    net: number;
    prevIncome: number;
    prevExpense: number;
    transactionCount: number;
    monthlyExpenseBaseline: number;
    monthlyIncomeBaseline: number;
  },
  locale: Locale
): Risk[] {
  const t = (key: string) => translate(key, locale);
  const money = (n: number) => formatQar(n, { locale });
  const risks: Risk[] = [];
  if (stats.transactionCount === 0) return risks;

  if (stats.net < 0) {
    risks.push({
      severity: "danger",
      title: t("risk.loss.title"),
      detail: `${t("risk.loss.detailPrefix")} ${money(Math.abs(stats.net))}.`,
    });
  }

  if (stats.totalIncome > 0 && stats.net > 0) {
    const margin = stats.net / stats.totalIncome;
    if (margin < 0.1) {
      risks.push({
        severity: "warn",
        title: t("risk.lowMargin.title"),
        detail: `${t("risk.lowMargin.detailPrefix")} ${(margin * 100).toFixed(1)}% ${t(
          "risk.lowMargin.detailSuffix"
        )}`,
      });
    }
  }

  if (stats.prevIncome > 0) {
    const drop = (stats.totalIncome - stats.prevIncome) / stats.prevIncome;
    if (drop < -0.2) {
      risks.push({
        severity: "warn",
        title: t("risk.revenueDrop.title"),
        detail: `${t("risk.revenueDrop.detailPrefix")} ${Math.round(
          Math.abs(drop) * 100
        )}% ${t("risk.revenueDrop.detailSuffix")}`,
      });
    }
  }

  if (stats.prevExpense > 0) {
    const rise = (stats.totalExpense - stats.prevExpense) / stats.prevExpense;
    if (rise > 0.3) {
      risks.push({
        severity: "warn",
        title: t("risk.expenseRise.title"),
        detail: `${t("risk.expenseRise.detailPrefix")} ${Math.round(rise * 100)}% ${t(
          "risk.expenseRise.detailSuffix"
        )}`,
      });
    }
  }

  // Fixed expenses exceed fixed income
  if (
    stats.monthlyExpenseBaseline > 0 &&
    stats.monthlyIncomeBaseline < stats.monthlyExpenseBaseline
  ) {
    const gap = stats.monthlyExpenseBaseline - stats.monthlyIncomeBaseline;
    risks.push({
      severity: "danger",
      title: t("risk.fixedGap.title"),
      detail: `${t("risk.fixedGap.detailPrefix")} ${money(gap)} ${t(
        "risk.fixedGap.detailSuffix"
      )}`,
    });
  }

  if (stats.totalExpense > 0 && stats.totalIncome === 0) {
    risks.push({
      severity: "danger",
      title: t("risk.noIncome.title"),
      detail: `${t("risk.noIncome.detailPrefix")} ${money(stats.totalExpense)} ${t(
        "risk.noIncome.detailSuffix"
      )}`,
    });
  }

  if (risks.length === 0 && stats.net > 0) {
    risks.push({
      severity: "ok",
      title: t("risk.healthy.title"),
      detail: `${t("risk.healthy.detailPrefix")} ${money(stats.net)} ${t(
        "risk.healthy.detailMargin"
      )} ${((stats.net / Math.max(1, stats.totalIncome)) * 100).toFixed(1)}%.`,
    });
  }

  return risks;
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/finance/actions.ts`

<a id="app-finance-actions-ts"></a>

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import {
  requireDeptLeadOrAbove,
  requireOwner,
} from "@/lib/auth-guards";
import { safeAmount, safeString, MAX_LONG_TEXT } from "@/lib/input-limits";

export async function createTransactionAction(formData: FormData) {
  // Recording numbers (income / expense / salary) is allowed for anyone at
  // dept_lead or above. Plain employees can NOT record transactions — that
  // closes the previous hole where any active user could create financial
  // records. The aggregation dashboard stays owner-only (page-level gate).
  const user = await requireDeptLeadOrAbove();

  const kind = formData.get("kind") as string | null;
  const category = formData.get("category") as string | null;
  let amount: number;
  let description: string | null;
  try {
    amount = safeAmount(formData.get("amountQar"));
    description = safeString(formData.get("description"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const projectId = (formData.get("projectId") as string | null) || null;
  const occurredAtRaw = formData.get("occurredAt") as string | null;
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
  const recurrence = (formData.get("recurrence") as string | null) || "none";
  const endsAtRaw = formData.get("recurrenceEndsAt") as string | null;
  const recurrenceEndsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (!kind || !["income", "expense"].includes(kind)) {
    return { ok: false, message: "اختر: دخل أو مصروف" };
  }
  if (!category) {
    return { ok: false, message: "الفئة مطلوبة" };
  }
  if (!amount || amount <= 0) {
    return { ok: false, message: "المبلغ لازم يكون موجب" };
  }
  if (!["none", "monthly"].includes(recurrence)) {
    return { ok: false, message: "نوع التكرار غير صحيح" };
  }

  const tx = await prisma.transaction.create({
    data: {
      kind,
      category,
      amountQar: amount,
      description,
      projectId,
      occurredAt,
      recurrence,
      recurrenceEndsAt: recurrence === "monthly" ? recurrenceEndsAt : null,
      createdById: user.id,
    },
  });

  await logAudit({
    action: "tx.create",
    target: {
      type: "transaction",
      id: tx.id,
      label: `${kind === "income" ? "+" : "−"}${amount.toLocaleString("en")} · ${category}`,
    },
    metadata: { kind, category, amountQar: amount, recurrence, projectId, description },
  });

  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTransactionAction(id: string) {
  // Only the owner (الرئيس) can delete — prevents managers / dept_leads from
  // wiping out their own entries to hide the trail. Audit log keeps the record
  // even after the transaction itself is gone.
  await requireOwner();
  const before = await prisma.transaction.findUnique({
    where: { id },
    include: { project: { select: { title: true } } },
  });
  await prisma.transaction.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "tx.delete",
      target: {
        type: "transaction",
        id,
        label: `${before.kind === "income" ? "+" : "−"}${before.amountQar.toLocaleString("en")} · ${before.category}`,
      },
      metadata: {
        kind: before.kind,
        category: before.category,
        amountQar: before.amountQar,
        projectTitle: before.project?.title ?? null,
        description: before.description,
      },
    });
  }
  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/admin/users/page.tsx`

<a id="app-admin-users-page-tsx"></a>

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listUsersWithBadges } from "@/lib/db/users";
import { prisma } from "@/lib/db/prisma";
import { UsersAdminClient } from "./users-admin-client";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { assignableRoles, isManagerOrAbove } from "@/lib/auth/roles";

export default async function AdminUsersPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  if (!session?.user) redirect("/login");
  if (!isManagerOrAbove(session.user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6 text-center">
          <div className="text-lg font-bold text-rose-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-sm text-zinc-400">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  const [users, allBadges] = await Promise.all([
    listUsersWithBadges(),
    prisma.badge.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("page.admin.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {users.length} {t("admin.accountsCount")} · {t("admin.subtitle")}
        </p>
      </div>
      <UsersAdminClient
        users={users}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
        allowedRoles={assignableRoles(session.user.role)}
        allBadges={allBadges}
        locale={locale}
      />
    </div>
  );
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/admin/users/actions.ts`

<a id="app-admin-users-actions-ts"></a>

```typescript
"use server";

import { revalidatePath } from "next/cache";
import {
  createUser,
  deleteUser,
  updateUser,
  findUserByEmail,
} from "@/lib/db/users";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import {
  requireManagerOrAbove,
  requireOwner,
} from "@/lib/auth-guards";
import {
  canAssignRole,
  isOwner,
  isValidRole,
  type Role,
} from "@/lib/auth/roles";

function userLabel(u: { name: string; email: string }) {
  return `${u.name} · ${u.email}`;
}

// All approval / role-assignment actions are open to MANAGER+. The owner
// (الرئيس) can grant any role; managers can grant only department_lead and
// employee. We always validate the requested role against the actor's
// `assignableRoles` so a manager can't bypass the UI to promote someone to
// admin or another manager.
async function requireRoleAssigner(targetRole: Role) {
  const actor = await requireManagerOrAbove();
  if (!canAssignRole(actor.role, targetRole)) {
    throw new Error("ما تقدر تعطي هذي الصلاحية — أعلى من مستواك");
  }
  return actor;
}

export async function addUserAction(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const name = (formData.get("name") as string | null)?.trim();
  const roleRaw = formData.get("role");
  const department =
    (formData.get("department") as string | null)?.trim() || null;

  if (!email || !name || !roleRaw) {
    return { ok: false, message: "كل الخانات مطلوبة" };
  }
  if (!isValidRole(roleRaw)) {
    return { ok: false, message: "الدور غير صحيح" };
  }
  const role = roleRaw;

  let actor;
  try {
    actor = await requireRoleAssigner(role);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "غير مسموح" };
  }

  if (await findUserByEmail(email)) {
    return { ok: false, message: "الإيميل موجود مسبقاً" };
  }

  // Manager-or-above-created users are approved immediately.
  const user = await createUser({ email, name, role, department });
  await prisma.user.update({
    where: { id: user.id },
    data: { approvedAt: new Date() },
  });
  await logAudit({
    action: "user.create",
    target: { type: "user", id: user.id, label: userLabel(user) },
    metadata: { role, department, byRole: actor.role },
  });
  revalidatePath("/admin/users");
  return { ok: true, message: `تم إضافة ${name}` };
}

export async function toggleUserActiveAction(id: string, active: boolean) {
  const actor = await requireManagerOrAbove();
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "الحساب غير موجود" };

  // Guard: a manager cannot deactivate / reactivate someone above their tier
  // (e.g. another manager or the owner). Only the owner can touch managers
  // and other owners.
  if (!isOwner(actor.role) && (before.role === "admin" || before.role === "manager")) {
    return { ok: false, message: "ما تقدر تعدّل على حساب بدرجتك أو فوق" };
  }

  await updateUser(id, { active });
  await logAudit({
    action: active ? "user.activate" : "user.deactivate",
    target: { type: "user", id, label: userLabel(before) },
    metadata: { byRole: actor.role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function changeUserRoleAction(id: string, role: Role) {
  if (!isValidRole(role)) {
    return { ok: false, message: "الدور غير صحيح" };
  }
  let actor;
  try {
    actor = await requireRoleAssigner(role);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "غير مسموح" };
  }

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "الحساب غير موجود" };

  // Don't let a manager DEMOTE someone above their tier either — only the
  // owner can change manager / admin roles.
  if (
    !isOwner(actor.role) &&
    (before.role === "admin" || before.role === "manager")
  ) {
    return { ok: false, message: "ما تقدر تغيّر دور حساب بدرجتك أو فوق" };
  }

  await updateUser(id, { role });
  await logAudit({
    action: "user.role_change",
    target: { type: "user", id, label: userLabel(before) },
    metadata: { from: before.role, to: role, byRole: actor.role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(id: string) {
  const actor = await requireManagerOrAbove();
  if (actor.id === id) {
    return { ok: false, message: "ما تقدر تحذف حسابك" };
  }
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "الحساب غير موجود" };

  // Same protection as toggle / role change — only owner can remove a manager
  // or another owner.
  if (!isOwner(actor.role) && (before.role === "admin" || before.role === "manager")) {
    return { ok: false, message: "ما تقدر تحذف حساب بدرجتك أو فوق" };
  }

  await deleteUser(id);
  await logAudit({
    action: "user.delete",
    target: { type: "user", id, label: userLabel(before) },
    metadata: {
      role: before.role,
      department: before.department,
      byRole: actor.role,
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Approve a pending sign-up: activate the account and assign role/department.
export async function approveUserAction(
  id: string,
  role: Role,
  department: string | null
) {
  if (!isValidRole(role)) {
    return { ok: false, message: "الدور غير صحيح" };
  }
  let actor;
  try {
    actor = await requireRoleAssigner(role);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "غير مسموح" };
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      active: true,
      approvedAt: new Date(),
      role,
      department: department?.trim() || null,
    },
  });

  // Drop a notification in the user's inbox so they know the moment they next
  // open the app — separate from any email Auth.js may send.
  await prisma.notification
    .create({
      data: {
        recipientId: id,
        kind: "user.approved",
        severity: "success",
        title: "تم تفعيل حسابك",
        body: `صلاحياتك: ${role}${department ? ` · ${department}` : ""}`,
        linkUrl: "/",
      },
    })
    .catch(() => {});

  await logAudit({
    action: "user.approve",
    target: { type: "user", id, label: userLabel(updated) },
    metadata: { role, department: department?.trim() || null, byRole: actor.role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Toggle a badge on a user. Add it if missing, remove it if present.
 * Returns { ok, attached } where `attached` reflects the new state.
 */
export async function toggleUserBadgeAction(userId: string, badgeId: string) {
  const actor = await requireManagerOrAbove();

  const [user, badge, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.badge.findUnique({ where: { id: badgeId } }),
    prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    }),
  ]);

  if (!user) return { ok: false as const, message: "الموظف ما لقيته" };
  if (!badge) return { ok: false as const, message: "الشارة ما لقيتها" };

  if (existing) {
    await prisma.userBadge.delete({
      where: { userId_badgeId: { userId, badgeId } },
    });
    await logAudit({
      action: "user.badge_remove",
      target: { type: "user", id: userId, label: userLabel(user) },
      metadata: { badge: badge.slug, badgeLabel: badge.labelAr },
    });
    revalidatePath("/admin/users");
    revalidatePath(`/team/${userId}`);
    return { ok: true as const, attached: false };
  }

  await prisma.userBadge.create({
    data: {
      userId,
      badgeId,
      assignedById: actor.id,
    },
  });
  await logAudit({
    action: "user.badge_add",
    target: { type: "user", id: userId, label: userLabel(user) },
    metadata: { badge: badge.slug, badgeLabel: badge.labelAr },
  });
  revalidatePath("/admin/users");
  revalidatePath(`/team/${userId}`);
  return { ok: true as const, attached: true };
}

// Reject a pending sign-up: deletes the row entirely. They can sign in again later
// which would re-queue them as pending. Owner-only — managers can approve but
// cannot hard-delete a record.
export async function rejectUserAction(id: string) {
  const actor = await requireOwner();
  if (actor.id === id) {
    return { ok: false, message: "ما تقدر تحذف حسابك" };
  }
  const before = await prisma.user.findUnique({ where: { id } });
  await prisma.user.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "user.reject",
      target: { type: "user", id, label: userLabel(before) },
    });
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/admin/users/users-admin-client.tsx`

<a id="app-admin-users-users-admin-client-tsx"></a>

```typescript
"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Plus, Trash2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Badge as BadgeRow, User, UserBadge } from "@prisma/client";
import { useT } from "@/lib/i18n/client";
import { type Role } from "@/lib/auth/roles";
import {
  addUserAction,
  approveUserAction,
  changeUserRoleAction,
  deleteUserAction,
  rejectUserAction,
  toggleUserActiveAction,
  toggleUserBadgeAction,
} from "./actions";

type AuthRole = Role;

const ROLE_COLOR: Record<AuthRole, string> = {
  admin: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  manager: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  department_lead: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  employee: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

type UserWithBadges = User & {
  badges: (UserBadge & { badge: BadgeRow })[];
};

interface Props {
  users: UserWithBadges[];
  currentUserId: string;
  // Role of the signed-in actor — used to gate the reject button (owner only).
  currentUserRole: AuthRole;
  // Roles this actor is allowed to assign. Owners get the full list; managers
  // get only [department_lead, employee] so they can never accidentally promote
  // someone to a level above themselves.
  allowedRoles: AuthRole[];
  allBadges: BadgeRow[];
  locale: "ar" | "en";
}

export function UsersAdminClient({
  users,
  currentUserId,
  currentUserRole,
  allowedRoles,
  allBadges,
  locale,
}: Props) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);
  const [flash, setFlash] = useState<{ tone: "success" | "error"; msg: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const showFlash = (tone: "success" | "error", msg: string) => {
    setFlash({ tone, msg });
    setTimeout(() => setFlash(null), 3500);
  };

  const pendingUsers = users.filter((u) => u.approvedAt === null);
  const approvedUsers = users.filter((u) => u.approvedAt !== null);

  const roleLabel = (r: AuthRole) => t(`role.${r}`);

  return (
    <div className="space-y-4">
      {flash && (
        <div
          className={cn(
            "rounded-lg border px-4 py-2 text-sm",
            flash.tone === "success"
              ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-400"
              : "border-rose-900/40 bg-rose-950/20 text-rose-400"
          )}
        >
          {flash.msg}
        </div>
      )}

      {pendingUsers.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">
              {t("admin.pending.title")} ({pendingUsers.length})
            </h3>
          </div>
          <p className="mb-3 text-xs text-amber-300/70">{t("admin.pending.desc")}</p>

          <ul className="space-y-2">
            {pendingUsers.map((u) => (
              <PendingRow
                key={u.id}
                user={u}
                isPending={isPending}
                allowedRoles={allowedRoles}
                canReject={currentUserRole === "admin"}
                onApprove={(role, dept) =>
                  startTransition(async () => {
                    const res = await approveUserAction(u.id, role, dept);
                    if (res.ok) showFlash("success", t("admin.pending.approvedToast"));
                    else showFlash("error", res.message ?? t("common.error"));
                  })
                }
                onReject={() =>
                  startTransition(async () => {
                    const res = await rejectUserAction(u.id);
                    if (res.ok) showFlash("success", t("admin.pending.rejectedToast"));
                    else showFlash("error", res.message ?? t("common.error"));
                  })
                }
              />
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500">{t("admin.users.hint")}</div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("action.addEmployee")}
        </button>
      </div>

      {addOpen && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold">{t("admin.users.addTitle")}</h4>
            <button
              onClick={() => setAddOpen(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            action={(formData) => {
              startTransition(async () => {
                const res = await addUserAction(formData);
                if (res.ok) {
                  showFlash("success", res.message ?? t("admin.users.addedToast"));
                  setAddOpen(false);
                } else {
                  showFlash("error", res.message ?? t("admin.users.addFailed"));
                }
              });
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <Field label={t("admin.users.field.name")}>
              <input
                name="name"
                required
                placeholder={t("admin.users.field.namePlaceholder")}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              />
            </Field>
            <Field label={t("admin.users.field.email")}>
              <input
                name="email"
                type="email"
                required
                placeholder="ahmed@gmail.com"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                dir="ltr"
              />
            </Field>
            <Field label={t("admin.users.field.role")}>
              <select
                name="role"
                required
                defaultValue={allowedRoles.includes("employee") ? "employee" : allowedRoles[0]}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              >
                {allowedRoles.includes("admin") && (
                  <option value="admin">{t("admin.users.roleOptAdmin")}</option>
                )}
                {allowedRoles.includes("manager") && (
                  <option value="manager">{t("admin.users.roleOptManager")}</option>
                )}
                {allowedRoles.includes("department_lead") && (
                  <option value="department_lead">{t("admin.users.roleOptDeptLead")}</option>
                )}
                {allowedRoles.includes("employee") && (
                  <option value="employee">{t("admin.users.roleOptEmployee")}</option>
                )}
              </select>
            </Field>
            <Field label={t("admin.users.field.department")}>
              <input
                name="department"
                placeholder="Creative · Accounts · Sales · Tech"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              />
            </Field>
            <div className="flex items-center justify-end gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                {t("action.cancel")}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {isPending ? t("action.adding") : t("admin.users.addBtn")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
        <ul className="divide-y divide-zinc-800/60">
          {approvedUsers.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-zinc-500">
              {t("admin.users.empty")}
            </li>
          )}
          {approvedUsers.map((u) => {
            const isSelf = u.id === currentUserId;
            // A manager (المدير) cannot edit / delete another manager or the
            // owner — only the owner can. We disable the controls so the UI
            // matches what the server enforces.
            const isAboveActor =
              currentUserRole !== "admin" &&
              (u.role === "admin" || u.role === "manager");
            const lockReason = isAboveActor
              ? t("admin.users.lockedHigherRank")
              : isSelf
              ? t("admin.users.youLabel")
              : null;
            return (
              <li key={u.id} className="flex flex-col gap-3 px-5 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">
                        {u.name}
                      </span>
                      {isSelf && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                          {t("admin.users.youLabel")}
                        </span>
                      )}
                      {!u.active && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                          {t("team.label.disabled")}
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500"
                      dir="ltr"
                    >
                      <span>{u.email}</span>
                      {u.department && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span>{u.department}</span>
                        </>
                      )}
                      {u.lastLoginAt && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span>
                            {t("admin.users.loginSince")}:{" "}
                            {new Date(u.lastLoginAt).toLocaleDateString("en")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-2"
                    title={lockReason ?? undefined}
                  >
                    <select
                      disabled={isSelf || isPending || isAboveActor}
                      value={u.role as AuthRole}
                      onChange={(e) => {
                        const newRole = e.target.value as AuthRole;
                        startTransition(async () => {
                          const res = await changeUserRoleAction(u.id, newRole);
                          if (!res.ok)
                            showFlash("error", res.message ?? t("common.error"));
                        });
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-semibold disabled:opacity-60",
                        ROLE_COLOR[u.role as AuthRole]
                      )}
                    >
                      {/* Always render the user's CURRENT role so the dropdown
                          can display it even if the actor isn't allowed to assign
                          it. The action server-side rejects illegal switches. */}
                      {!allowedRoles.includes(u.role as AuthRole) && (
                        <option value={u.role}>{roleLabel(u.role as AuthRole)}</option>
                      )}
                      {allowedRoles.includes("admin") && (
                        <option value="admin">{roleLabel("admin")}</option>
                      )}
                      {allowedRoles.includes("manager") && (
                        <option value="manager">{roleLabel("manager")}</option>
                      )}
                      {allowedRoles.includes("department_lead") && (
                        <option value="department_lead">{roleLabel("department_lead")}</option>
                      )}
                      {allowedRoles.includes("employee") && (
                        <option value="employee">{roleLabel("employee")}</option>
                      )}
                    </select>
                    <button
                      disabled={isSelf || isPending || isAboveActor}
                      onClick={() => {
                        startTransition(async () => {
                          const res = await toggleUserActiveAction(u.id, !u.active);
                          if (!res.ok)
                            showFlash("error", res.message ?? t("common.error"));
                        });
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition disabled:opacity-40",
                        u.active
                          ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      )}
                    >
                      {u.active
                        ? t("admin.users.toggleDeactivate")
                        : t("admin.users.toggleActivate")}
                    </button>
                    <button
                      disabled={isSelf || isPending || isAboveActor}
                      onClick={() => {
                        if (!confirm(`${t("admin.users.deleteConfirm")} ${u.name}`))
                          return;
                        startTransition(async () => {
                          const res = await deleteUserAction(u.id);
                          if (!res.ok)
                            showFlash("error", res.message ?? t("common.error"));
                        });
                      }}
                      className="rounded-md border border-rose-500/30 p-1.5 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
                      aria-label={t("action.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <UserBadgeRow
                  user={u}
                  allBadges={allBadges}
                  locale={locale}
                  disabled={isPending}
                  onToggle={(badgeId) =>
                    startTransition(async () => {
                      const res = await toggleUserBadgeAction(u.id, badgeId);
                      if (!res.ok)
                        showFlash("error", res.message ?? t("common.error"));
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function UserBadgeRow({
  user,
  allBadges,
  locale,
  disabled,
  onToggle,
}: {
  user: UserWithBadges;
  allBadges: BadgeRow[];
  locale: "ar" | "en";
  disabled: boolean;
  onToggle: (badgeId: string) => void;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const ownedIds = new Set(user.badges.map((b) => b.badgeId));
  const availableToAdd = allBadges.filter((b) => !ownedIds.has(b.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-800/40 pt-2">
      <span className="text-[10px] uppercase tracking-wider text-zinc-600">
        {t("badges.label")}:
      </span>
      {user.badges.length === 0 && !picking && (
        <span className="text-[11px] text-zinc-600">{t("badges.empty")}</span>
      )}
      {user.badges.map((ub) => (
        <BadgeChip
          key={ub.badgeId}
          badge={ub.badge}
          locale={locale}
          disabled={disabled}
          onRemove={() => onToggle(ub.badgeId)}
        />
      ))}

      {picking ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-950 p-1.5">
          {availableToAdd.length === 0 && (
            <span className="px-2 text-[11px] text-zinc-600">
              {t("badges.allAssigned")}
            </span>
          )}
          {availableToAdd.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                onToggle(b.id);
                if (availableToAdd.length === 1) setPicking(false);
              }}
              disabled={disabled}
              className="flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-40"
            >
              <span>{b.icon}</span>
              <span>{locale === "ar" ? b.labelAr : b.labelEn}</span>
            </button>
          ))}
          <button
            onClick={() => setPicking(false)}
            className="rounded-full p-0.5 text-zinc-500 hover:text-zinc-300"
            aria-label="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        availableToAdd.length > 0 && (
          <button
            onClick={() => setPicking(true)}
            disabled={disabled}
            className="flex items-center gap-1 rounded-full border border-dashed border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500 transition hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            {t("badges.add")}
          </button>
        )
      )}
    </div>
  );
}

function BadgeChip({
  badge,
  locale,
  disabled,
  onRemove,
}: {
  badge: BadgeRow;
  locale: "ar" | "en";
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
      style={{
        borderColor: badge.colorHex + "55",
        backgroundColor: badge.colorHex + "15",
        color: badge.colorHex,
      }}
    >
      <span>{badge.icon}</span>
      <span>{locale === "ar" ? badge.labelAr : badge.labelEn}</span>
      <button
        onClick={onRemove}
        disabled={disabled}
        className="ml-1 rounded-full p-0.5 hover:bg-black/20 disabled:opacity-40"
        aria-label="Remove"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function PendingRow({
  user,
  isPending,
  allowedRoles,
  canReject,
  onApprove,
  onReject,
}: {
  user: User;
  isPending: boolean;
  allowedRoles: AuthRole[];
  canReject: boolean;
  onApprove: (role: AuthRole, department: string | null) => void;
  onReject: () => void;
}) {
  const t = useT();
  const defaultRole: AuthRole = allowedRoles.includes("employee")
    ? "employee"
    : allowedRoles[0] ?? "employee";
  const [role, setRole] = useState<AuthRole>(defaultRole);
  const [department, setDepartment] = useState("");

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-zinc-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-zinc-100">{user.name}</div>
        <div className="mt-0.5 text-xs text-zinc-500" dir="ltr">
          {user.email}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[10px] text-amber-300/70">
          {t("admin.pending.roleLabel")}:
          <select
            value={role}
            disabled={isPending}
            onChange={(e) => setRole(e.target.value as AuthRole)}
            className="rounded-md border border-amber-500/30 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
          >
            {allowedRoles.includes("employee") && (
              <option value="employee">{t("role.employee")}</option>
            )}
            {allowedRoles.includes("department_lead") && (
              <option value="department_lead">{t("role.department_lead")}</option>
            )}
            {allowedRoles.includes("manager") && (
              <option value="manager">{t("role.manager")}</option>
            )}
            {allowedRoles.includes("admin") && (
              <option value="admin">{t("role.admin")}</option>
            )}
          </select>
        </label>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          disabled={isPending}
          placeholder={t("admin.pending.deptLabel")}
          className="w-40 rounded-md border border-amber-500/30 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
        />
        <button
          onClick={() => onApprove(role, department || null)}
          disabled={isPending}
          className="flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          <Check className="h-3 w-3" />
          {t("admin.pending.approve")}
        </button>
        {canReject && (
          <button
            onClick={() => {
              if (!confirm(`${t("admin.pending.reject")}: ${user.email}?`)) return;
              onReject();
            }}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md border border-rose-500/30 px-3 py-1 text-xs text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
          >
            <X className="h-3 w-3" />
            {t("admin.pending.reject")}
          </button>
        )}
      </div>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/tasks/actions.ts`

<a id="app-tasks-actions-ts"></a>

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requireActiveUser as requireAuth } from "@/lib/auth-guards";
import { isDeptLeadOrAbove } from "@/lib/auth/roles";
import { createNotification } from "@/lib/db/notifications";
import {
  safeString,
  MAX_LONG_TEXT,
  MAX_TITLE_LEN,
} from "@/lib/input-limits";

export async function createTaskAction(formData: FormData) {
  const user = await requireAuth();

  let title: string | null;
  let description: string | null;
  try {
    title = safeString(formData.get("title"), MAX_TITLE_LEN);
    description = safeString(formData.get("description"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const projectId = (formData.get("projectId") as string | null) || null;
  const assigneeId = (formData.get("assigneeId") as string | null) || null;
  const priority = (formData.get("priority") as string | null) || "normal";
  const status = (formData.get("status") as string | null) || "todo";
  const dueAtRaw = formData.get("dueAt") as string | null;
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;
  const estimatedHoursRaw = formData.get("estimatedHours") as string | null;
  const estimatedHours = estimatedHoursRaw ? parseFloat(estimatedHoursRaw) : null;

  if (!title) {
    return { ok: false, message: "عنوان المهمة مطلوب" };
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      projectId,
      assigneeId,
      creatorId: user.id,
      priority,
      status,
      dueAt,
      estimatedHours: estimatedHours && !isNaN(estimatedHours) ? estimatedHours : null,
    },
  });

  await prisma.taskUpdate.create({
    data: {
      taskId: task.id,
      actorId: user.id,
      type: "created",
      toValue: status,
    },
  });

  // Drop a notification in the assignee's inbox so they know the moment a task
  // is dropped on them. Always fire — even self-assignments — so the push
  // reaches their phone (the desktop creator may not be looking at their
  // phone at the moment, and that's the channel they actually need).
  if (assigneeId) {
    await createNotification({
      recipientId: assigneeId,
      kind: "task.assigned",
      severity: "info",
      title: `مهمة جديدة: ${title}`,
      body: dueAt ? `الموعد: ${dueAt.toLocaleString("ar")}` : null,
      linkUrl: "/tasks",
      refType: "task",
      refId: task.id,
    }).catch(() => null);
  }

  await logAudit({
    action: "task.create",
    target: { type: "task", id: task.id, label: task.title },
    metadata: { projectId, assigneeId, priority, status },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: task.id };
}

export async function updateTaskStatusAction(id: string, status: string) {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { ok: false, message: "المهمة غير موجودة" };

  const wasDone = task.status === "done";
  const nowDone = status === "done";

  await prisma.task.update({
    where: { id },
    data: {
      status,
      ...(nowDone && !wasDone ? { completedAt: new Date() } : {}),
      ...(!nowDone && wasDone ? { completedAt: null } : {}),
      ...(status === "in_progress" && !task.startedAt
        ? { startedAt: new Date() }
        : {}),
    },
  });

  await prisma.taskUpdate.create({
    data: {
      taskId: id,
      actorId: user.id,
      type: "status_change",
      fromValue: task.status,
      toValue: status,
    },
  });

  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateTaskAction(id: string, formData: FormData) {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { ok: false, message: "المهمة غير موجودة" };

  const title = (formData.get("title") as string | null)?.trim();
  const description = formData.get("description") as string | null;
  const assigneeId = formData.get("assigneeId") as string | null;
  const priority = formData.get("priority") as string | null;
  const status = formData.get("status") as string | null;
  const dueAtRaw = formData.get("dueAt") as string | null;
  const projectId = formData.get("projectId") as string | null;
  const estimatedHoursRaw = formData.get("estimatedHours") as string | null;
  // Collaborators arrive as CSV string "id1,id2,id3"
  const collaboratorsRaw = formData.get("collaboratorIds") as string | null;
  const collaboratorIds =
    collaboratorsRaw === null
      ? null
      : collaboratorsRaw
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

  const wasDone = task.status === "done";
  const nowDone = status === "done";
  const estHours = estimatedHoursRaw ? parseFloat(estimatedHoursRaw) : undefined;

  // If dueAt was rescheduled FORWARD (later than the previous value), reset
  // the reminder flags so a fresh "due-soon" alert can fire for the new
  // window. We only reset on forward moves so backward moves don't accidentally
  // re-trigger an alert that was already sent.
  const newDueAt = dueAtRaw === null ? undefined : dueAtRaw ? new Date(dueAtRaw) : null;
  const dueMovedForward =
    newDueAt !== undefined &&
    newDueAt !== null &&
    (!task.dueAt || newDueAt.getTime() > task.dueAt.getTime());

  await prisma.task.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(description !== null ? { description: description.trim() || null } : {}),
      ...(assigneeId !== null ? { assigneeId: assigneeId || null } : {}),
      ...(priority ? { priority } : {}),
      ...(status ? { status } : {}),
      ...(projectId !== null ? { projectId: projectId || null } : {}),
      ...(estHours !== undefined && !isNaN(estHours) ? { estimatedHours: estHours } : {}),
      ...(dueAtRaw !== null
        ? { dueAt: dueAtRaw ? new Date(dueAtRaw) : null }
        : {}),
      ...(dueMovedForward
        ? { reminderBeforeSentAt: null, reminderOverdueSentAt: null }
        : {}),
      ...(nowDone && !wasDone ? { completedAt: new Date() } : {}),
      ...(!nowDone && wasDone ? { completedAt: null } : {}),
    },
  });

  // Notify the new assignee whenever it changes — fires on self-assignment too
  // so the phone gets the push. (Same reasoning as createTaskAction.)
  if (
    assigneeId !== null &&
    assigneeId &&
    assigneeId !== task.assigneeId
  ) {
    await createNotification({
      recipientId: assigneeId,
      kind: "task.assigned",
      severity: "info",
      title: `صار عندك مهمة: ${title ?? task.title}`,
      linkUrl: "/tasks",
      refType: "task",
      refId: id,
    }).catch(() => null);
  }

  // Replace collaborators list if provided.
  if (collaboratorIds !== null) {
    // Filter out the primary assignee so they aren't also a collaborator.
    const effectiveAssignee =
      assigneeId !== null ? (assigneeId || null) : task.assigneeId;
    const finalCollabs = collaboratorIds.filter((cid) => cid !== effectiveAssignee);

    await prisma.taskCollaborator.deleteMany({ where: { taskId: id } });
    if (finalCollabs.length > 0) {
      await prisma.taskCollaborator.createMany({
        data: finalCollabs.map((userId) => ({ taskId: id, userId })),
      });
    }
  }

  // Audit trail for assignee changes.
  if (assigneeId !== null && assigneeId !== task.assigneeId) {
    await prisma.taskUpdate.create({
      data: {
        taskId: id,
        actorId: user.id,
        type: "assignee_change",
        fromValue: task.assigneeId,
        toValue: assigneeId || null,
      },
    });
  }
  if (status && status !== task.status) {
    await prisma.taskUpdate.create({
      data: {
        taskId: id,
        actorId: user.id,
        type: "status_change",
        fromValue: task.status,
        toValue: status,
      },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/team");
  revalidatePath(`/team/${task.assigneeId}`);
  if (assigneeId) revalidatePath(`/team/${assigneeId}`);
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  if (projectId && projectId !== task.projectId) revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteTaskAction(id: string) {
  // Tighter than before: only the creator, the assignee, or a dept_lead+ can
  // delete a task. Stops random employees from wiping a teammate's work.
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { ok: false, message: "المهمة غير موجودة" };

  const isCreator = task.creatorId === user.id;
  const isAssignee = task.assigneeId === user.id;
  if (!isCreator && !isAssignee && !isDeptLeadOrAbove(user.role)) {
    return { ok: false, message: "ما تقدر تحذف مهمة موب لك" };
  }

  await prisma.task.delete({ where: { id } });
  await logAudit({
    action: "task.delete",
    target: { type: "task", id, label: task.title },
    metadata: { projectId: task.projectId, status: task.status },
  });
  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true };
}

// Server-side flag setters for the in-app reminder poller. Each one stamps
// the corresponding `reminderXxxSentAt` so the next /api/tasks/upcoming poll
// won't return the same task again. We also drop a Notification row in the
// recipient's inbox so they have a record they can review later from any
// device — even if their browser missed the desktop notification.

export async function markTaskBeforeReminderSentAction(id: string) {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { title: true } } },
  });
  if (!task) return { ok: false };

  // Only the assignee or a collaborator may mark — prevents an outsider from
  // silencing somebody else's reminder.
  const collab = await prisma.taskCollaborator.findUnique({
    where: { taskId_userId: { taskId: id, userId: user.id } },
  });
  if (task.assigneeId !== user.id && !collab) return { ok: false };

  await prisma.task.updateMany({
    where: { id, reminderBeforeSentAt: null },
    data: { reminderBeforeSentAt: new Date() },
  });

  await createNotification({
    recipientId: user.id,
    kind: "task.due_soon",
    severity: "warning",
    title: `قرّب موعد المهمة: ${task.title}`,
    body: task.dueAt ? `الموعد: ${task.dueAt.toLocaleString("ar")}` : null,
    linkUrl: "/tasks",
    refType: "task",
    refId: id,
    dedupeKey: { kind: "task.due_soon", refType: "task", refId: id },
  }).catch(() => null);

  return { ok: true };
}

export async function markTaskOverdueReminderSentAction(id: string) {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { title: true, deadlineAt: true } } },
  });
  if (!task) return { ok: false };

  const collab = await prisma.taskCollaborator.findUnique({
    where: { taskId_userId: { taskId: id, userId: user.id } },
  });
  if (task.assigneeId !== user.id && !collab) return { ok: false };

  await prisma.task.updateMany({
    where: { id, reminderOverdueSentAt: null },
    data: { reminderOverdueSentAt: new Date() },
  });

  await createNotification({
    recipientId: user.id,
    kind: "task.overdue",
    severity: "danger",
    title: `تأخّرت المهمة: ${task.title}`,
    body: task.project?.deadlineAt
      ? `لكن موعد التسليم للعميل: ${task.project.deadlineAt.toLocaleString("ar")} — لسا في وقت`
      : "تجاوزت موعدها — حدّثها",
    linkUrl: "/tasks",
    refType: "task",
    refId: id,
    dedupeKey: { kind: "task.overdue", refType: "task", refId: id },
  }).catch(() => null);

  return { ok: true };
}


export async function addCommentAction(taskId: string, content: string) {
  const user = await requireAuth();
  if (!content.trim()) return { ok: false };
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false };

  await prisma.taskComment.create({
    data: {
      taskId,
      authorId: user.id,
      content: content.trim(),
    },
  });
  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true };
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/api/tasks/upcoming/route.ts`

<a id="app-api-tasks-upcoming-route-ts"></a>

```typescript
// Polled by the in-app reminder bar to find tasks that are about to be due,
// or are already overdue, for the signed-in user. Returns at most two windows:
//
//   1. Due-soon: dueAt within the next 60 minutes, reminderBeforeSentAt is null,
//      task is still open (todo / in_progress / in_review), and the user is the
//      assignee or a collaborator.
//
//   2. Overdue-with-slack: dueAt has passed, the task is still open, and the
//      project deadlineAt is either null OR still in the future (i.e. there's
//      still slack to recover). reminderOverdueSentAt must be null. Surfaces
//      the situation the owner specifically called out: a TASK passed its
//      internal deadline but the CLIENT delivery date is still salvageable.
//
// Returns an array per window so the client can fire one notification per task
// per window with idempotent server-side flags.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

const DUE_SOON_WINDOW_MIN = 70; // 70m so polling drift doesn't miss the 60m mark

const OPEN_STATUSES = ["todo", "in_progress", "in_review"];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const soonWindowEnd = new Date(now.getTime() + DUE_SOON_WINDOW_MIN * 60 * 1000);

  // Tasks the user is responsible for: assignee OR collaborator.
  const baseFilter = {
    status: { in: OPEN_STATUSES },
    OR: [
      { assigneeId: userId },
      { collaborators: { some: { userId } } },
    ],
  };

  const [dueSoon, overdue] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...baseFilter,
        dueAt: { gte: now, lte: soonWindowEnd },
        reminderBeforeSentAt: null,
      },
      orderBy: { dueAt: "asc" },
      select: {
        id: true,
        title: true,
        dueAt: true,
        priority: true,
        project: { select: { id: true, title: true, deadlineAt: true } },
      },
      take: 20,
    }),
    prisma.task.findMany({
      where: {
        ...baseFilter,
        dueAt: { lt: now },
        reminderOverdueSentAt: null,
        // Project still recoverable: no project deadline OR deadline in future.
        OR: [
          { projectId: null },
          { project: { deadlineAt: null } },
          { project: { deadlineAt: { gte: now } } },
        ],
      },
      orderBy: { dueAt: "asc" },
      select: {
        id: true,
        title: true,
        dueAt: true,
        priority: true,
        project: { select: { id: true, title: true, deadlineAt: true } },
      },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    dueSoon,
    overdue,
    now: now.toISOString(),
  });
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `lib/db/notifications.ts`

<a id="lib-db-notifications-ts"></a>

```typescript
// Per-user notification helpers. The bell icon in the topbar polls
// /api/notifications/recent every 30s; server actions and reminder fires
// drop new rows here. We deliberately keep titles + bodies pre-localized
// so we can avoid round-tripping through i18n at render time — the writer
// uses the SAME locale resolver as the rest of the app.
//
// Side-effect: every successful createNotification call also fires a Web
// Push to all of the recipient's registered devices. That's the path that
// reaches phones whose browser is closed / locked — the desktop bell only
// updates when the tab is actually open. Push failures are swallowed so a
// dead subscription never blocks the in-app inbox.

import { prisma } from "./prisma";
import { pushToUser, type PushPayload } from "@/lib/push/web-push";

export type NotificationSeverity = "info" | "success" | "warning" | "danger";

export interface CreateNotificationInput {
  recipientId: string;
  kind: string;
  title: string;
  body?: string | null;
  severity?: NotificationSeverity;
  linkUrl?: string | null;
  refType?: string | null;
  refId?: string | null;
  // Dedupe key — when given, we skip creating a new row if one already exists
  // for the same recipient + kind + refId. Prevents flooding the inbox if
  // a poller fires twice for the same condition.
  dedupeKey?: { kind: string; refType: string; refId: string };
}

export async function createNotification(input: CreateNotificationInput) {
  if (input.dedupeKey) {
    const existing = await prisma.notification.findFirst({
      where: {
        recipientId: input.recipientId,
        kind: input.dedupeKey.kind,
        refType: input.dedupeKey.refType,
        refId: input.dedupeKey.refId,
      },
      select: { id: true },
    });
    if (existing) return existing;
  }

  const created = await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      severity: input.severity ?? "info",
      linkUrl: input.linkUrl ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
    },
  });

  // Fan out to web-push so the alert reaches the user's phone / locked screen.
  // Best-effort — never blocks notification creation.
  const pushPayload: PushPayload = {
    title: input.title,
    body: input.body ?? "",
    url: input.linkUrl ?? "/",
    tag: input.refId ? `${input.kind}-${input.refId}` : input.kind,
    severity: input.severity ?? "info",
  };
  pushToUser(input.recipientId, pushPayload).catch(() => null);

  return created;
}

/**
 * Same as createNotification but for many recipients at once. Used when a single
 * event (e.g. a project deadline approaching) needs to alert every assigned
 * member. Failures are swallowed per-recipient so one bad row doesn't block
 * the rest.
 */
export async function createNotificationMany(
  recipientIds: string[],
  input: Omit<CreateNotificationInput, "recipientId">
) {
  await Promise.all(
    recipientIds.map((recipientId) =>
      createNotification({ ...input, recipientId }).catch(() => null)
    )
  );
}

export async function listForUser(
  recipientId: string,
  options?: { limit?: number; unreadOnly?: boolean }
) {
  return prisma.notification.findMany({
    where: {
      recipientId,
      ...(options?.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 30,
  });
}

export async function unreadCount(recipientId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientId, readAt: null },
  });
}

export async function markRead(recipientId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: {
      recipientId,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/notifications/actions.ts`

<a id="app-notifications-actions-ts"></a>

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth-guards";
import { markRead } from "@/lib/db/notifications";

export async function markNotificationsReadAction(ids?: string[]) {
  const user = await requireActiveUser();
  await markRead(user.id, ids);
  revalidatePath("/");
  return { ok: true };
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/api/notifications/recent/route.ts`

<a id="app-api-notifications-recent-route-ts"></a>

```typescript
// Bell-icon poller. Returns the recent notifications for the signed-in user
// plus the unread count. Cheap query — kept tight (last 30 entries) so the
// 30-second poll stays light.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listForUser, unreadCount } from "@/lib/db/notifications";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [items, unread] = await Promise.all([
    listForUser(session.user.id, { limit: 30 }),
    unreadCount(session.user.id),
  ]);

  return NextResponse.json({
    items,
    unread,
    now: new Date().toISOString(),
  });
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `components/notification-bell.tsx`

<a id="components-notification-bell-tsx"></a>

```typescript
"use client";

// Bell icon for the topbar. Polls /api/notifications/recent every 30s to keep
// the unread badge fresh, and pops a panel showing the latest 30 entries when
// clicked. Marks-as-read on open so the badge clears as soon as the user
// acknowledges them.
//
// Permission gate: every authed user sees the bell. Notifications are scoped
// per recipient at the DB layer so an employee never sees the owner's
// finance-threshold alerts.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { markNotificationsReadAction } from "@/app/notifications/actions";

const POLL_INTERVAL_MS = 30_000;

interface Notif {
  id: string;
  kind: string;
  severity: "info" | "success" | "warning" | "danger";
  title: string;
  body: string | null;
  linkUrl: string | null;
  refType: string | null;
  refId: string | null;
  readAt: string | null;
  createdAt: string;
}

const SEVERITY_TONE: Record<Notif["severity"], string> = {
  info: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  danger: "border-rose-500/30 bg-rose-500/5 text-rose-300",
};

export function NotificationBell() {
  const t = useT();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/recent", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Notif[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // ignore — next poll will retry
    }
  }, []);

  useEffect(() => {
    // Defer the first call to the next microtask so we don't trigger a
    // setState during the effect body (avoids React's set-state-in-effect lint
    // warning and keeps the initial render cheap).
    void Promise.resolve().then(refresh);
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Click-outside to close the panel.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && unread > 0) {
        // Optimistic clear, then sync server.
        setUnread(0);
        setItems((items) =>
          items.map((it) => (it.readAt ? it : { ...it, readAt: new Date().toISOString() }))
        );
        void markNotificationsReadAction().catch(() => {});
      }
      return next;
    });
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/70 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
        aria-label={t("notifications.title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute end-0 top-11 z-50 w-80 max-w-[92vw] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Inbox className="h-3.5 w-3.5" />
              {t("notifications.title")}
            </div>
            {items.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <CheckCheck className="h-3 w-3" />
                {t("notifications.allRead")}
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-zinc-500">
                <Inbox className="h-6 w-6 text-zinc-700" />
                {t("notifications.empty")}
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/60">
                {items.map((n) => (
                  <li key={n.id}>
                    <a
                      href={n.linkUrl ?? "#"}
                      onClick={() => n.linkUrl && setOpen(false)}
                      className={cn(
                        "block px-4 py-2.5 transition hover:bg-zinc-900/70",
                        !n.readAt && "bg-zinc-900/40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                            n.severity === "danger" && "bg-rose-500",
                            n.severity === "warning" && "bg-amber-500",
                            n.severity === "success" && "bg-emerald-500",
                            n.severity === "info" && "bg-sky-500"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-zinc-100">
                            {n.title}
                          </div>
                          {n.body && (
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              {n.body}
                            </div>
                          )}
                          <div className="mt-1 text-[10px] text-zinc-600">
                            {new Date(n.createdAt).toLocaleString("ar")}
                          </div>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export severity tone constants in case other surfaces (e.g. a future
// /notifications full page) want the same color palette.
export { SEVERITY_TONE };

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `components/meeting-reminder.tsx`

<a id="components-meeting-reminder-tsx"></a>

```typescript
"use client";

// Global background poller — checks every 30s for upcoming events and fires
// desktop notifications + sound at the appropriate windows:
//   * Client meetings: 1 hour before.
//   * Photo shoots: 24 hours before AND 1 hour before (crew needs prep time).
//
// Reliability notes:
// - Polling (not push) because the app is Windows-local, not deployed with a worker.
// - Reminders are tracked server-side (reminderSentAt columns) so a second tab
//   doesn't double-fire. After showing the notification we POST back to mark it.
// - localStorage also tracks fired IDs per-browser + window so even if the server
//   is slow to persist, we don't re-alert for the same event in the same session.

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { markReminderSentAction } from "@/app/meetings/actions";
import {
  markShootDayReminderSentAction,
  markShootHourReminderSentAction,
} from "@/app/shoots/actions";
import {
  markTaskBeforeReminderSentAction,
  markTaskOverdueReminderSentAction,
} from "@/app/tasks/actions";

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const REMIND_MINUTES_BEFORE = 60; // 1 hour
const SHOOT_DAY_BEFORE_MINUTES = 24 * 60;
const LOCAL_STORAGE_KEY = "srb_fired_reminders";

interface UpcomingMeeting {
  id: string;
  clientName: string;
  companyName: string | null;
  meetingAt: string;
  durationMin: number;
  location: string | null;
  meetingLink: string | null;
  owner: { id: string; name: string } | null;
}

interface UpcomingShoot {
  id: string;
  title: string;
  shootDate: string;
  durationHours: number;
  location: string;
  locationNotes: string | null;
  mapUrl: string | null;
  reminderDayBeforeSentAt: string | null;
  reminderHourBeforeSentAt: string | null;
  crew: { user: { id: string; name: string } }[];
}

interface UpcomingTask {
  id: string;
  title: string;
  dueAt: string;
  priority: string;
  project: { id: string; title: string; deadlineAt: string | null } | null;
}

/** Small helper: play a short beep so the alert is audible even if notifications are muted. */
function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    osc.onended = () => ctx.close();
  } catch {
    // Best-effort — silence failures.
  }
}

function getFired(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function addFired(id: string) {
  try {
    const s = getFired();
    s.add(id);
    // Cap at 200 to avoid unbounded growth
    const arr = Array.from(s).slice(-200);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export function MeetingReminder() {
  const t = useT();
  const [permissionRequested, setPermissionRequested] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fire = useCallback(
    (m: UpcomingMeeting) => {
      const minsAway = Math.max(
        0,
        Math.round((new Date(m.meetingAt).getTime() - Date.now()) / 60_000)
      );
      const title = `${t("meetings.reminder.title")} · ${m.clientName}`;
      const companySuffix = m.companyName ? ` (${m.companyName})` : "";
      const body = `${t("meetings.reminder.in")} ${minsAway} ${t(
        "meetings.reminder.minutes"
      )}${companySuffix}${m.location ? ` · ${m.location}` : ""}`;

      // Desktop notification (best-effort)
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(title, {
            body,
            icon: "/srb-logo-white.png",
            tag: `meeting-${m.id}`,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            window.location.href = "/meetings";
            n.close();
          };
        } catch {
          // some browsers throw on certain configs
        }
      }

      playBeep();
      addFired(m.id);

      // Tell the server so other browsers/tabs don't re-alert.
      void markReminderSentAction(m.id).catch(() => {});
    },
    [t]
  );

  const fireTask = useCallback(
    (task: UpcomingTask, kind: "due_soon" | "overdue") => {
      const dueDate = new Date(task.dueAt);
      const minsAway = Math.round((dueDate.getTime() - Date.now()) / 60_000);
      const isOverdue = kind === "overdue";

      const title = isOverdue
        ? `⏰ ${t("tasks.reminder.overdue")} · ${task.title}`
        : `⌛ ${t("tasks.reminder.dueSoon")} · ${task.title}`;
      const projectSuffix = task.project ? ` · ${task.project.title}` : "";
      const slackHint =
        isOverdue && task.project?.deadlineAt
          ? ` · ${t("tasks.reminder.deliveryStillOk")}`
          : "";
      const body = isOverdue
        ? `${t("tasks.reminder.lateBy")} ${Math.abs(minsAway)} ${t(
            "tasks.reminder.minutes"
          )}${projectSuffix}${slackHint}`
        : `${t("tasks.reminder.in")} ${Math.max(0, minsAway)} ${t(
            "tasks.reminder.minutes"
          )}${projectSuffix}`;

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(title, {
            body,
            icon: "/srb-logo-white.png",
            tag: `task-${task.id}-${kind}`,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            window.location.href = "/tasks";
            n.close();
          };
        } catch {
          // ignore
        }
      }

      playBeep();
      addFired(`task-${task.id}-${kind}`);

      void (kind === "overdue"
        ? markTaskOverdueReminderSentAction(task.id).catch(() => {})
        : markTaskBeforeReminderSentAction(task.id).catch(() => {}));
    },
    [t]
  );

  const fireShoot = useCallback(
    (s: UpcomingShoot, when: "day" | "hour") => {
      const minsAway = Math.max(
        0,
        Math.round((new Date(s.shootDate).getTime() - Date.now()) / 60_000)
      );
      const title =
        when === "day"
          ? `📸 ${t("shoots.reminder.titleDay")} · ${s.title}`
          : `📸 ${t("shoots.reminder.titleHour")} · ${s.title}`;
      const body = `${t("shoots.reminder.in")} ${
        when === "day"
          ? Math.round(minsAway / 60) + " " + t("shoots.reminder.hours")
          : minsAway + " " + t("shoots.reminder.minutes")
      } · ${s.location}`;

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(title, {
            body,
            icon: "/srb-logo-white.png",
            tag: `shoot-${s.id}-${when}`,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            window.location.href = "/shoots";
            n.close();
          };
        } catch {
          // ignore
        }
      }

      playBeep();
      addFired(`shoot-${s.id}-${when}`);

      void (when === "day"
        ? markShootDayReminderSentAction(s.id).catch(() => {})
        : markShootHourReminderSentAction(s.id).catch(() => {}));
    },
    [t]
  );

  const poll = useCallback(async () => {
    const now = Date.now();
    const fired = getFired();

    // Meetings: 1h before
    try {
      const res = await fetch("/api/meetings/upcoming", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { meetings: UpcomingMeeting[] };
        const threshold = REMIND_MINUTES_BEFORE * 60 * 1000;
        for (const m of data.meetings) {
          if (fired.has(m.id)) continue;
          const msUntil = new Date(m.meetingAt).getTime() - now;
          if (msUntil <= threshold && msUntil > -60_000) {
            fire(m);
          }
        }
      }
    } catch {
      // ignore
    }

    // Tasks: due-soon (60m) + overdue-with-slack
    try {
      const res = await fetch("/api/tasks/upcoming", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          dueSoon: UpcomingTask[];
          overdue: UpcomingTask[];
        };
        for (const tk of data.dueSoon) {
          const key = `task-${tk.id}-due_soon`;
          if (fired.has(key)) continue;
          fireTask(tk, "due_soon");
        }
        for (const tk of data.overdue) {
          const key = `task-${tk.id}-overdue`;
          if (fired.has(key)) continue;
          fireTask(tk, "overdue");
        }
      }
    } catch {
      // ignore
    }

    // Shoots: 24h before + 1h before
    try {
      const res = await fetch("/api/shoots/upcoming", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { shoots: UpcomingShoot[] };
        const hourThreshold = REMIND_MINUTES_BEFORE * 60 * 1000;
        const dayThreshold = SHOOT_DAY_BEFORE_MINUTES * 60 * 1000;
        for (const s of data.shoots) {
          const msUntil = new Date(s.shootDate).getTime() - now;
          if (msUntil <= 0 && msUntil > -60_000) continue;

          // 24h-before window — fire once when between 23.5h and 24.5h before.
          const dayKey = `shoot-${s.id}-day`;
          if (
            !s.reminderDayBeforeSentAt &&
            !fired.has(dayKey) &&
            msUntil <= dayThreshold &&
            msUntil > dayThreshold - 60 * 60 * 1000 // inside the 1-hour slot around the 24h mark
          ) {
            fireShoot(s, "day");
          }

          // 1h-before window
          const hourKey = `shoot-${s.id}-hour`;
          if (
            !s.reminderHourBeforeSentAt &&
            !fired.has(hourKey) &&
            msUntil <= hourThreshold &&
            msUntil > -60_000
          ) {
            fireShoot(s, "hour");
          }
        }
      }
    } catch {
      // ignore
    }
  }, [fire, fireShoot, fireTask]);

  useEffect(() => {
    // Ask for notification permission once (non-blocking).
    if (
      !permissionRequested &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().finally(() => setPermissionRequested(true));
    }

    // Poll immediately, then on interval.
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll, permissionRequested]);

  // Renders nothing visible — it's a background runner.
  return null;
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `lib/push/web-push.ts`

<a id="lib-push-web-push-ts"></a>

```typescript
// Web Push delivery — wraps the `web-push` library so the rest of the code
// can call `pushToUser(userId, payload)` and ignore the cryptography.
//
// VAPID keys (the proof-of-identity the browser asks for) come from env vars.
// They're generated once with: `npx web-push generate-vapid-keys`. The public
// key is shipped to the page (so the browser can subscribe); the private key
// stays on the server.
//
// Failure model:
//   • 404 / 410 from the push service = the subscription expired or the user
//     unsubscribed → we delete the row.
//   • Anything else = transient → we keep the row and log.

import webpush from "web-push";
import { prisma } from "@/lib/db/prisma";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@srb.network";
  if (!publicKey || !privateKey) {
    return false; // not configured — caller decides what to do
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  severity?: "info" | "warning" | "danger" | "success";
  // Free-form data — passed through to the SW. Useful for click handlers.
  data?: Record<string, unknown>;
}

/**
 * Push a payload to every device registered for `userId`. Returns the count
 * of successful deliveries. Subscriptions that the push service tells us
 * are gone (404 / 410) are deleted automatically.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/",
    tag: payload.tag ?? `srb-${Date.now()}`,
    severity: payload.severity ?? "info",
    data: payload.data ?? {},
  });

  let delivered = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json,
          { TTL: 60 * 60 } // hold for up to 1h if device offline
        );
        delivered += 1;
        await prisma.pushSubscription
          .update({
            where: { endpoint: sub.endpoint },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => null);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode ?? 0;
        if (status === 404 || status === 410) {
          // Subscription is gone — clean it up.
          await prisma.pushSubscription
            .delete({ where: { endpoint: sub.endpoint } })
            .catch(() => null);
        } else {
          // eslint-disable-next-line no-console
          console.error("[push] send failed", { endpoint: sub.endpoint.slice(0, 60), status });
        }
      }
    })
  );
  return delivered;
}

/**
 * Push to multiple users in parallel. Used when a single event (e.g. a
 * project deadline) needs to alert every assigned member.
 */
export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  const counts = await Promise.all(userIds.map((id) => pushToUser(id, payload)));
  return counts.reduce((a, b) => a + b, 0);
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/api/push/public-key/route.ts`

<a id="app-api-push-public-key-route-ts"></a>

```typescript
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

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/api/push/subscribe/route.ts`

<a id="app-api-push-subscribe-route-ts"></a>

```typescript
// Stores a Web Push subscription against the signed-in user. The browser
// hands us { endpoint, keys: { p256dh, auth } } after the user grants
// notification permission and `pushManager.subscribe()` succeeds.
//
// Idempotent — if the same endpoint comes in again (same user same device),
// we update the keys instead of creating a duplicate row.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

interface SubscribeBody {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sub = body.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth_ = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth_) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Trim wildly long fields so a misbehaving client can't dump 10MB into
  // the table. Real values are well under 1KB.
  if (endpoint.length > 1000 || p256dh.length > 200 || auth_.length > 200) {
    return NextResponse.json({ error: "field_too_long" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? null;

  // upsert by endpoint — same device returning means we just refresh the keys.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh,
      auth: auth_,
      userId: session.user.id,
      userAgent,
    },
    update: {
      p256dh,
      auth: auth_,
      userId: session.user.id,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/api/push/unsubscribe/route.ts`

<a id="app-api-push-unsubscribe-route-ts"></a>

```typescript
// Remove a Web Push subscription — called when the user turns off
// notifications in the UI (or clicks Unsubscribe in their account).
// Only the owner of the subscription (or an owner-tier admin) can delete.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { isOwner } from "@/lib/auth/roles";

interface UnsubscribeBody {
  endpoint?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: UnsubscribeBody;
  try {
    body = (await req.json()) as UnsubscribeBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const endpoint = body.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "missing_endpoint" }, { status: 400 });
  }

  const sub = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (!sub) return NextResponse.json({ ok: true }); // already gone

  if (sub.userId !== session.user.id && !isOwner(session.user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.pushSubscription.delete({ where: { endpoint } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/api/push/resubscribe/route.ts`

<a id="app-api-push-resubscribe-route-ts"></a>

```typescript
// Service-worker calls this when the browser rotates the subscription
// (pushsubscriptionchange event). We replace the old endpoint with the
// new one, keeping the same user binding.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

interface ResubBody {
  oldEndpoint?: string;
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ResubBody;
  try {
    body = (await req.json()) as ResubBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const newEndpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth_ = body.subscription?.keys?.auth;
  if (!newEndpoint || !p256dh || !auth_) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Drop the old row if we know what it was (and it belonged to this user).
  if (body.oldEndpoint) {
    await prisma.pushSubscription
      .deleteMany({
        where: { endpoint: body.oldEndpoint, userId: session.user.id },
      })
      .catch(() => null);
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: newEndpoint },
    create: {
      endpoint: newEndpoint,
      p256dh,
      auth: auth_,
      userId: session.user.id,
    },
    update: {
      p256dh,
      auth: auth_,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `components/push-enable-button.tsx`

<a id="components-push-enable-button-tsx"></a>

```typescript
"use client";

// Tiny button + status pill that lets the user opt into Web Push for THIS
// device. Shown next to the notification bell in the topbar. The flow:
//   1. Check if browser supports Notifications + ServiceWorker + PushManager.
//   2. Register /sw.js if not already registered.
//   3. On click, ask for Notification permission.
//   4. Subscribe to PushManager with the VAPID public key from the server.
//   5. POST the subscription to /api/push/subscribe so we can target it later.
//
// State machine: unsupported → off → enabling → on → error
//
// On iOS, push only works when the app is installed to the home screen
// (Add to Home Screen). We detect that and show a friendly hint.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { csrfFetch } from "@/lib/csrf-client";

type State = "unknown" | "unsupported" | "off" | "enabling" | "on" | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS exposes standalone via navigator; everywhere else uses display-mode.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosStandalone = (window.navigator as any).standalone === true;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return Boolean(iosStandalone || mediaStandalone);
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PushEnableButton() {
  const t = useT();
  const [state, setState] = useState<State>("unknown");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const initialised = useRef(false);

  // Probe browser capabilities + existing subscription on mount.
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    (async () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) {
        setState("unsupported");
        return;
      }

      // iOS Safari: push only works when installed as PWA — show a hint instead
      // of letting the user fail.
      if (isIOS() && !isStandalone()) {
        setState("unsupported");
        return;
      }

      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = reg ? await reg.pushManager.getSubscription() : null;
        setState(existing ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  const enable = useCallback(async () => {
    setErrorMsg(null);
    setState("enabling");
    try {
      // 1. Make sure the SW is registered. Re-register is a no-op if same script.
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ??
        (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;

      // 2. Permission gate.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("off");
        setErrorMsg(t("push.error.permission"));
        return;
      }

      // 3. Public key from server.
      const keyRes = await fetch("/api/push/public-key", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const keyData = (await keyRes.json()) as {
        publicKey: string | null;
        configured: boolean;
      };
      if (!keyData.configured || !keyData.publicKey) {
        setState("error");
        setErrorMsg(t("push.error.notConfigured"));
        return;
      }

      // 4. Subscribe. Cast to BufferSource — TS's lib.dom Uint8Array generic
      // doesn't perfectly match what the WebPush API actually accepts.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          keyData.publicKey
        ) as unknown as BufferSource,
      });

      // 5. Tell the server. csrfFetch reads the csrf-token cookie and attaches
      // it as x-csrf-token automatically — same path used everywhere else.
      const res = await csrfFetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        setState("error");
        setErrorMsg(t("push.error.serverReject"));
        return;
      }

      setState("on");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : t("push.error.generic"));
    }
  }, [t]);

  const disable = useCallback(async () => {
    setErrorMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await csrfFetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : t("push.error.generic"));
    }
  }, [t]);

  if (state === "unknown") {
    return null;
  }

  if (state === "unsupported") {
    const iosNeedsInstall = isIOS() && !isStandalone();
    return (
      <div className="relative">
        <button
          onClick={() => setShowHint((v) => !v)}
          className="flex h-9 items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 text-[10px] text-zinc-500 hover:border-zinc-700"
          aria-label={t("push.unsupported.label")}
        >
          <BellOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("push.unsupported.label")}</span>
        </button>
        {showHint && (
          <div className="absolute end-0 top-11 z-50 w-72 max-w-[92vw] rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 text-[11px] text-zinc-300 shadow-2xl shadow-black/60">
            {iosNeedsInstall ? (
              <div className="space-y-1.5">
                <div className="font-semibold text-amber-300">
                  {t("push.iosHint.title")}
                </div>
                <ol className="list-inside list-decimal space-y-1 text-zinc-400">
                  <li>{t("push.iosHint.step1")}</li>
                  <li>{t("push.iosHint.step2")}</li>
                  <li>{t("push.iosHint.step3")}</li>
                </ol>
              </div>
            ) : (
              t("push.unsupported.desc")
            )}
          </div>
        )}
      </div>
    );
  }

  const onClick = state === "on" ? disable : enable;
  const Icon = state === "on" ? BellRing : state === "enabling" ? Loader2 : Bell;
  const label =
    state === "on"
      ? t("push.on")
      : state === "enabling"
      ? t("push.enabling")
      : t("push.off");
  const tone =
    state === "on"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
      : state === "error"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
      : "border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:border-zinc-700";

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={state === "enabling"}
        className={cn(
          "flex h-9 items-center gap-1 rounded-full border px-2.5 text-[10px] transition disabled:opacity-60",
          tone
        )}
        aria-label={label}
        title={errorMsg ?? label}
      >
        <Icon className={cn("h-3.5 w-3.5", state === "enabling" && "animate-spin")} />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </div>
  );
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `public/manifest.json`

<a id="public-manifest-json"></a>

```json
{
  "name": "SRB — نظام الإدارة الداخلي",
  "short_name": "SRB",
  "description": "نظام الإدارة الداخلي لشركة SRB — مهام، اجتماعات، تصوير، ماليات",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "lang": "ar",
  "dir": "rtl",
  "categories": ["business", "productivity"],
  "icons": [
    {
      "src": "/srb-logo.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/srb-logo.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/srb-logo-white.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "المهام",
      "short_name": "Tasks",
      "url": "/tasks",
      "icons": [{ "src": "/srb-logo.png", "sizes": "192x192" }]
    },
    {
      "name": "المشاريع",
      "short_name": "Projects",
      "url": "/projects",
      "icons": [{ "src": "/srb-logo.png", "sizes": "192x192" }]
    },
    {
      "name": "الاجتماعات",
      "short_name": "Meetings",
      "url": "/meetings",
      "icons": [{ "src": "/srb-logo.png", "sizes": "192x192" }]
    }
  ]
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `public/sw.js`

<a id="public-sw-js"></a>

```javascript
// SRB Service Worker — handles Web Push notifications + offline shell.
//
// Lives at /sw.js so its scope is the whole origin. When the browser receives
// a push from our backend (via /api/push/send → web-push library → FCM or APNs)
// it wakes the SW, runs the `push` listener, and shows the notification —
// even if the SRB tab is closed and the phone is locked. This is the only
// reliable way to deliver alerts on mobile when the user isn't looking at
// the page.
//
// Note: iOS Safari requires the user to first install the app to the home
// screen (Add to Home Screen) before push works. Android Chrome works
// directly from the browser.

const CACHE_NAME = "srb-v1";

// Skip waiting so a new SW activates as soon as it's installed — keeps
// production deploys from being stuck on a stale worker for the typical
// user lifetime.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------------------------
// Push handler — invoked by the browser when our server sends a Web Push.
// Payload format (JSON):
//   {
//     title: string
//     body?: string
//     url?: string         // where to navigate when the user taps
//     tag?: string         // dedupe key — same tag replaces previous notification
//     icon?: string        // override default icon
//     badge?: string       // small monochrome icon for status bar (Android)
//     severity?: "info"|"warning"|"danger"|"success"
//     vibrate?: number[]   // ms pattern
//   }
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    // Fallback for plain-text pushes
    payload = { title: "SRB", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "SRB";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/srb-logo.png",
    badge: payload.badge || "/srb-logo-white.png",
    tag: payload.tag || `srb-${Date.now()}`,
    data: { url: payload.url || "/" },
    requireInteraction: payload.severity === "danger",
    vibrate: payload.vibrate || [200, 100, 200],
    dir: "rtl",
    lang: "ar",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------------------------------------------------------------------------
// Click handler — focus an existing tab if one is open at the target URL,
// otherwise open a new one.
// ---------------------------------------------------------------------------

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Prefer reusing an open tab on the same origin.
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.origin === target.origin && "focus" in client) {
            await client.focus();
            // Navigate to the target route if we can.
            if ("navigate" in client) {
              await client.navigate(target.href);
            }
            return;
          }
        } catch {
          // bad URL — ignore and continue
        }
      }

      // No matching client — open a new window.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// ---------------------------------------------------------------------------
// Push subscription change — re-subscribe automatically if the browser
// invalidates the old subscription (this can happen after token rotation).
// We POST the new subscription back to the server so it can replace the
// stored row.
// ---------------------------------------------------------------------------

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
        // Refetch the public key the same way the page does, then resubscribe.
        const keyRes = await fetch("/api/push/public-key", { credentials: "same-origin" });
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        await fetch("/api/push/resubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            oldEndpoint,
            subscription: newSub.toJSON(),
          }),
        });
      } catch {
        // Best-effort — if we can't refresh, the next page load will reconcile.
      }
    })()
  );
});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `scripts/generate-vapid-keys.mjs`

<a id="scripts-generate-vapid-keys-mjs"></a>

```javascript
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

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `lib/reminders/scheduler.ts`

<a id="lib-reminders-scheduler-ts"></a>

```typescript
// Server-side reminder scheduler.
//
// Runs every 60 seconds inside the Next.js process (started from
// instrumentation.ts). Scans the DB for events that should fire an alert
// right now and creates a Notification row for each — which in turn fans
// out to Web Push so the alert reaches the user's phone even when the
// SRB tab is closed and the screen is locked.
//
// The previous design relied on a client-side poller (MeetingReminder
// component) that could only fire when the user had a tab open. That's
// useless for the actual mobile use case the owner asked about. This
// server scheduler is the canonical alert pipeline; the in-app poller
// stays as a redundant desktop-toast layer for when the page IS open.
//
// Coverage:
//   • Meetings   — 60 min before meetingAt
//   • PhotoShoot — 24h before AND 1h before shootDate
//   • Tasks      — 60 min before dueAt (assignee + collaborators)
//                  + 1st time the task crosses dueAt while still open AND
//                    project deadline is still in the future
//   • Invoices   — 3 days before, day-of, and overdue (owner + manager only,
//                  since these contain financial data)
//
// Idempotency: each event has a `reminderXxxSentAt` column; the scheduler
// only acts on rows where the column is null, then stamps it. Safe to
// run on overlapping schedules — at most one notification per event per
// window.

import { prisma } from "@/lib/db/prisma";
import { createNotification, createNotificationMany } from "@/lib/db/notifications";

const TICK_MS = 60 * 1000; // 1 minute

// We claim a window slightly larger than 1h so that polling drift never
// misses an event. Combined with the SentAt flag this stays idempotent.
const MEETING_WINDOW_MIN = 65;
const SHOOT_HOUR_WINDOW_MIN = 65;
const SHOOT_DAY_WINDOW_HOURS_LO = 23.5;
const SHOOT_DAY_WINDOW_HOURS_HI = 24.5;
const TASK_DUE_WINDOW_MIN = 65;
const INVOICE_BEFORE_DAYS_LO = 2.5;
const INVOICE_BEFORE_DAYS_HI = 3.5;

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;
const MS_DAY = 24 * MS_HOUR;

type Globals = typeof globalThis & { __srbReminderTimer?: NodeJS.Timeout };

let running = false;

/** Start the scheduler. Idempotent — second call is a no-op. */
export function startReminderScheduler() {
  const g = globalThis as Globals;
  if (g.__srbReminderTimer) return;

  // Fire once 30s after boot to catch anything that fell through during the
  // restart window, then on a 1-min cadence.
  setTimeout(() => {
    void tick();
  }, 30_000);
  g.__srbReminderTimer = setInterval(() => void tick(), TICK_MS);
  // eslint-disable-next-line no-console
  console.log("[reminders] scheduler started — tick every 60s");
}

async function tick() {
  if (running) return; // skip if previous tick still in flight
  running = true;
  try {
    await Promise.all([
      checkMeetings(),
      checkShoots(),
      checkTasks(),
      checkInvoices(),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[reminders] tick failed:", err);
  } finally {
    running = false;
  }
}

// ---------------------------------------------------------------------------
// Meetings — 60 min before meetingAt
// ---------------------------------------------------------------------------

async function checkMeetings() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + MEETING_WINDOW_MIN * MS_MIN);

  const meetings = await prisma.clientMeeting.findMany({
    where: {
      status: "scheduled",
      meetingAt: { gte: now, lte: windowEnd },
      reminderSentAt: null,
    },
    select: {
      id: true,
      clientName: true,
      companyName: true,
      meetingAt: true,
      location: true,
      meetingLink: true,
      ownerId: true,
    },
  });

  for (const m of meetings) {
    if (!m.ownerId) {
      // Owner-less meeting — nobody to notify. Just stamp it so we don't
      // re-check next tick.
      await prisma.clientMeeting.updateMany({
        where: { id: m.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
      continue;
    }

    const minsAway = Math.max(0, Math.round((m.meetingAt.getTime() - now.getTime()) / MS_MIN));
    const where = m.location ? ` · ${m.location}` : m.meetingLink ? " · أونلاين" : "";

    await createNotification({
      recipientId: m.ownerId,
      kind: "meeting.soon",
      severity: "warning",
      title: `📅 اجتماع بعد ${minsAway} دقيقة — ${m.clientName}`,
      body: m.companyName
        ? `${m.companyName}${where}`
        : `${m.meetingAt.toLocaleString("ar")}${where}`,
      linkUrl: "/meetings",
      refType: "meeting",
      refId: m.id,
      dedupeKey: { kind: "meeting.soon", refType: "meeting", refId: m.id },
    });

    // Mark as sent so we don't re-fire next tick.
    await prisma.clientMeeting.updateMany({
      where: { id: m.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
  }
}

// ---------------------------------------------------------------------------
// Photo shoots — 24h before AND 1h before, alerts go to every crew member
// ---------------------------------------------------------------------------

async function checkShoots() {
  const now = new Date();
  const dayLo = new Date(now.getTime() + SHOOT_DAY_WINDOW_HOURS_LO * MS_HOUR);
  const dayHi = new Date(now.getTime() + SHOOT_DAY_WINDOW_HOURS_HI * MS_HOUR);
  const hourEnd = new Date(now.getTime() + SHOOT_HOUR_WINDOW_MIN * MS_MIN);

  // 24h-before window
  const dayShoots = await prisma.photoShoot.findMany({
    where: {
      status: "scheduled",
      shootDate: { gte: dayLo, lte: dayHi },
      reminderDayBeforeSentAt: null,
    },
    select: {
      id: true,
      title: true,
      shootDate: true,
      location: true,
      crew: { select: { userId: true } },
    },
  });

  for (const s of dayShoots) {
    const recipients = s.crew.map((c) => c.userId);
    if (recipients.length > 0) {
      await createNotificationMany(recipients, {
        kind: "shoot.day_before",
        severity: "warning",
        title: `📸 تصوير بكره — ${s.title}`,
        body: `${s.shootDate.toLocaleString("ar")}${s.location ? ` · ${s.location}` : ""}`,
        linkUrl: "/shoots",
        refType: "shoot",
        refId: s.id,
        dedupeKey: { kind: "shoot.day_before", refType: "shoot", refId: s.id },
      });
    }
    await prisma.photoShoot.updateMany({
      where: { id: s.id, reminderDayBeforeSentAt: null },
      data: { reminderDayBeforeSentAt: new Date() },
    });
  }

  // 1h-before window
  const hourShoots = await prisma.photoShoot.findMany({
    where: {
      status: "scheduled",
      shootDate: { gte: now, lte: hourEnd },
      reminderHourBeforeSentAt: null,
    },
    select: {
      id: true,
      title: true,
      shootDate: true,
      location: true,
      crew: { select: { userId: true } },
    },
  });

  for (const s of hourShoots) {
    const recipients = s.crew.map((c) => c.userId);
    const minsAway = Math.max(0, Math.round((s.shootDate.getTime() - now.getTime()) / MS_MIN));
    if (recipients.length > 0) {
      await createNotificationMany(recipients, {
        kind: "shoot.hour_before",
        severity: "danger",
        title: `📸 تصوير بعد ${minsAway} دقيقة — ${s.title}`,
        body: s.location ?? "تأكد من المعدات",
        linkUrl: "/shoots",
        refType: "shoot",
        refId: s.id,
        dedupeKey: { kind: "shoot.hour_before", refType: "shoot", refId: s.id },
      });
    }
    await prisma.photoShoot.updateMany({
      where: { id: s.id, reminderHourBeforeSentAt: null },
      data: { reminderHourBeforeSentAt: new Date() },
    });
  }
}

// ---------------------------------------------------------------------------
// Tasks — 60 min before dueAt + overdue-with-slack
// ---------------------------------------------------------------------------

const OPEN_STATUSES = ["todo", "in_progress", "in_review"];

async function checkTasks() {
  const now = new Date();
  const soonEnd = new Date(now.getTime() + TASK_DUE_WINDOW_MIN * MS_MIN);

  // Due-soon (60 min before)
  const dueSoon = await prisma.task.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      dueAt: { gte: now, lte: soonEnd },
      reminderBeforeSentAt: null,
    },
    select: {
      id: true,
      title: true,
      dueAt: true,
      assigneeId: true,
      collaborators: { select: { userId: true } },
      project: { select: { title: true } },
    },
  });

  for (const t of dueSoon) {
    const recipients = collectTaskRecipients(t.assigneeId, t.collaborators);
    if (recipients.length > 0) {
      const minsAway = Math.max(0, Math.round((t.dueAt!.getTime() - now.getTime()) / MS_MIN));
      await createNotificationMany(recipients, {
        kind: "task.due_soon",
        severity: "warning",
        title: `⌛ مهمة بعد ${minsAway} دقيقة — ${t.title}`,
        body: t.project?.title ?? "تأكد من إنهاءها",
        linkUrl: "/tasks",
        refType: "task",
        refId: t.id,
        dedupeKey: { kind: "task.due_soon", refType: "task", refId: t.id },
      });
    }
    await prisma.task.updateMany({
      where: { id: t.id, reminderBeforeSentAt: null },
      data: { reminderBeforeSentAt: new Date() },
    });
  }

  // Overdue-with-slack (task past dueAt, project deadline still future)
  const overdue = await prisma.task.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      dueAt: { lt: now },
      reminderOverdueSentAt: null,
      OR: [
        { projectId: null },
        { project: { deadlineAt: null } },
        { project: { deadlineAt: { gte: now } } },
      ],
    },
    select: {
      id: true,
      title: true,
      dueAt: true,
      assigneeId: true,
      collaborators: { select: { userId: true } },
      project: { select: { title: true, deadlineAt: true } },
    },
  });

  for (const t of overdue) {
    const recipients = collectTaskRecipients(t.assigneeId, t.collaborators);
    if (recipients.length > 0) {
      const slack = t.project?.deadlineAt
        ? `لكن تسليم العميل: ${t.project.deadlineAt.toLocaleString("ar")}`
        : "تجاوزت موعدها — حدّثها";
      await createNotificationMany(recipients, {
        kind: "task.overdue",
        severity: "danger",
        title: `⏰ مهمة متأخرة — ${t.title}`,
        body: slack,
        linkUrl: "/tasks",
        refType: "task",
        refId: t.id,
        dedupeKey: { kind: "task.overdue", refType: "task", refId: t.id },
      });
    }
    await prisma.task.updateMany({
      where: { id: t.id, reminderOverdueSentAt: null },
      data: { reminderOverdueSentAt: new Date() },
    });
  }
}

function collectTaskRecipients(
  assigneeId: string | null,
  collaborators: { userId: string }[]
): string[] {
  const set = new Set<string>();
  if (assigneeId) set.add(assigneeId);
  for (const c of collaborators) set.add(c.userId);
  return Array.from(set);
}

// ---------------------------------------------------------------------------
// Invoices — owner + manager get the alert (financial data)
// ---------------------------------------------------------------------------

async function checkInvoices() {
  const now = new Date();
  const beforeLo = new Date(now.getTime() + INVOICE_BEFORE_DAYS_LO * MS_DAY);
  const beforeHi = new Date(now.getTime() + INVOICE_BEFORE_DAYS_HI * MS_DAY);
  const dueWindowEnd = new Date(now.getTime() + 0.5 * MS_DAY);
  const dueWindowStart = new Date(now.getTime() - 1 * MS_DAY);
  const overdueCutoff = new Date(now.getTime() - 1 * MS_DAY);

  // Recipients: every active admin + manager. Re-resolved each tick so a new
  // hire / promotion gets included without restarting the process.
  const recipients = await prisma.user
    .findMany({
      where: { active: true, role: { in: ["admin", "manager"] } },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));
  if (recipients.length === 0) return;

  // 3-days-before window
  const beforeProjects = await prisma.project.findMany({
    where: {
      billingType: "monthly",
      status: { in: ["active", "on_hold"] },
      nextInvoiceDueAt: { gte: beforeLo, lte: beforeHi },
      invoiceReminderBeforeSentAt: null,
    },
    select: { id: true, title: true, budgetQar: true, nextInvoiceDueAt: true },
  });
  for (const p of beforeProjects) {
    await createNotificationMany(recipients, {
      kind: "invoice.before",
      severity: "info",
      title: `🧾 فاتورة بعد 3 أيام — ${p.title}`,
      body: `${p.budgetQar.toLocaleString("en")} ر.ق`,
      linkUrl: "/projects",
      refType: "project",
      refId: p.id,
      dedupeKey: { kind: "invoice.before", refType: "project", refId: p.id },
    });
    await prisma.project.updateMany({
      where: { id: p.id, invoiceReminderBeforeSentAt: null },
      data: { invoiceReminderBeforeSentAt: new Date() },
    });
  }

  // Day-of window
  const dueProjects = await prisma.project.findMany({
    where: {
      billingType: "monthly",
      status: { in: ["active", "on_hold"] },
      nextInvoiceDueAt: { gte: dueWindowStart, lte: dueWindowEnd },
      invoiceReminderDueSentAt: null,
    },
    select: { id: true, title: true, budgetQar: true },
  });
  for (const p of dueProjects) {
    await createNotificationMany(recipients, {
      kind: "invoice.due",
      severity: "warning",
      title: `🧾 فاتورة اليوم — ${p.title}`,
      body: `${p.budgetQar.toLocaleString("en")} ر.ق · حصّلها اليوم`,
      linkUrl: "/projects",
      refType: "project",
      refId: p.id,
      dedupeKey: { kind: "invoice.due", refType: "project", refId: p.id },
    });
    await prisma.project.updateMany({
      where: { id: p.id, invoiceReminderDueSentAt: null },
      data: { invoiceReminderDueSentAt: new Date() },
    });
  }

  // Overdue (>= 1 day past due, still not collected)
  const overdueProjects = await prisma.project.findMany({
    where: {
      billingType: "monthly",
      status: { in: ["active", "on_hold"] },
      nextInvoiceDueAt: { lt: overdueCutoff },
      invoiceReminderOverdueSentAt: null,
    },
    select: { id: true, title: true, budgetQar: true, nextInvoiceDueAt: true },
  });
  for (const p of overdueProjects) {
    const daysLate = Math.max(
      1,
      Math.round((now.getTime() - (p.nextInvoiceDueAt?.getTime() ?? now.getTime())) / MS_DAY)
    );
    await createNotificationMany(recipients, {
      kind: "invoice.overdue",
      severity: "danger",
      title: `🧾 فاتورة متأخرة ${daysLate} يوم — ${p.title}`,
      body: `${p.budgetQar.toLocaleString("en")} ر.ق · لاحق العميل`,
      linkUrl: "/projects",
      refType: "project",
      refId: p.id,
      dedupeKey: { kind: "invoice.overdue", refType: "project", refId: p.id },
    });
    await prisma.project.updateMany({
      where: { id: p.id, invoiceReminderOverdueSentAt: null },
      data: { invoiceReminderOverdueSentAt: new Date() },
    });
  }
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `lib/db/audit.ts`

<a id="lib-db-audit-ts"></a>

```typescript
// Audit log helper — every sensitive mutation should call logAudit so the
// admin can later see who did what, when, and against which target.
//
// Design notes:
// - actorEmail is snapshotted because actors can be deleted while history stays.
// - metadata is JSON-stringified (SQLite has no native JSON column in this schema).
// - Failures to log are swallowed (best-effort) — we never block a user action
//   just because logging failed. Real production would alert on this instead.

import { prisma } from "./prisma";
import { auth } from "@/auth";

export type AuditAction =
  // User management
  | "user.create"
  | "user.approve"
  | "user.reject"
  | "user.delete"
  | "user.deactivate"
  | "user.activate"
  | "user.role_change"
  | "user.department_change"
  | "user.profile_change"
  | "user.badge_add"
  | "user.badge_remove"
  // Permission overrides — Owner-only Permission Control Panel
  | "permission.grant"
  | "permission.revoke"
  | "permission.reset"
  // Project
  | "project.create"
  | "project.update"
  | "project.delete"
  | "project.status_change"
  | "project.member_add"
  | "project.member_remove"
  // Task
  | "task.create"
  | "task.update"
  | "task.delete"
  | "task.assignee_change"
  | "task.status_change"
  // Meeting
  | "meeting.create"
  | "meeting.update"
  | "meeting.delete"
  // Photo shoot
  | "shoot.create"
  | "shoot.update"
  | "shoot.delete"
  // Equipment
  | "equipment.create"
  | "equipment.update"
  | "equipment.delete"
  | "equipment.checkout"
  // Finance
  | "tx.create"
  | "tx.update"
  | "tx.delete"
  // Client (CRM)
  | "client.create"
  | "client.update"
  | "client.delete"
  // Backup
  | "backup.run";

export interface AuditTarget {
  type:
    | "user"
    | "project"
    | "task"
    | "transaction"
    | "backup"
    | "meeting"
    | "shoot"
    | "equipment"
    | "client";
  id?: string | null;
  label?: string | null;
}

export async function logAudit(args: {
  action: AuditAction;
  target?: AuditTarget;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorEmail?: string | null;
}) {
  try {
    let actorId = args.actorId ?? null;
    let actorEmail = args.actorEmail ?? null;
    if (!actorEmail) {
      const session = await auth();
      actorId = actorId ?? session?.user?.id ?? null;
      actorEmail = session?.user?.email ?? "system";
    }

    await prisma.auditLog.create({
      data: {
        actorId,
        actorEmail: actorEmail ?? "system",
        action: args.action,
        targetType: args.target?.type ?? null,
        targetId: args.target?.id ?? null,
        targetLabel: args.target?.label ?? null,
        metadata: args.metadata ? JSON.stringify(args.metadata) : null,
      },
    });
  } catch (err) {
    // Don't break user actions if logging fails.
    console.error("[audit] failed to write log entry:", err);
  }
}

/** Parse stored metadata back to an object (or null if malformed). */
export function parseAuditMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Human-readable label for an action (Arabic). */
export const AUDIT_ACTION_LABEL_AR: Record<AuditAction, string> = {
  "user.create": "إنشاء حساب",
  "user.approve": "تفعيل حساب",
  "user.reject": "رفض وحذف طلب",
  "user.delete": "حذف حساب",
  "user.deactivate": "تعطيل حساب",
  "user.activate": "تفعيل حساب",
  "user.role_change": "تغيير الدور",
  "user.department_change": "تغيير القسم",
  "user.profile_change": "تعديل بيانات موظف",
  "user.badge_add": "إضافة شارة",
  "user.badge_remove": "إزالة شارة",
  "permission.grant": "منح صلاحية",
  "permission.revoke": "سحب صلاحية",
  "permission.reset": "إرجاع الصلاحية للافتراضي",
  "project.create": "إنشاء مشروع",
  "project.update": "تعديل مشروع",
  "project.delete": "حذف مشروع",
  "project.status_change": "تغيير حالة مشروع",
  "project.member_add": "إضافة عضو للمشروع",
  "project.member_remove": "حذف عضو من المشروع",
  "task.create": "إنشاء مهمة",
  "task.update": "تعديل مهمة",
  "task.delete": "حذف مهمة",
  "task.assignee_change": "تغيير مسؤول المهمة",
  "task.status_change": "تغيير حالة المهمة",
  "meeting.create": "إنشاء اجتماع",
  "meeting.update": "تعديل اجتماع",
  "meeting.delete": "حذف اجتماع",
  "shoot.create": "إنشاء جلسة تصوير",
  "shoot.update": "تعديل جلسة تصوير",
  "shoot.delete": "حذف جلسة تصوير",
  "equipment.create": "إضافة معدات",
  "equipment.update": "تعديل معدات",
  "equipment.delete": "حذف معدات",
  "equipment.checkout": "استلام / تسليم معدات",
  "tx.create": "إضافة معاملة مالية",
  "tx.update": "تعديل معاملة مالية",
  "tx.delete": "حذف معاملة مالية",
  "client.create": "إضافة عميل",
  "client.update": "تعديل بيانات عميل",
  "client.delete": "حذف عميل",
  "backup.run": "نسخ احتياطي",
};

export const AUDIT_ACTION_LABEL_EN: Record<AuditAction, string> = {
  "user.create": "Create account",
  "user.approve": "Approve account",
  "user.reject": "Reject & delete request",
  "user.delete": "Delete account",
  "user.deactivate": "Deactivate account",
  "user.activate": "Activate account",
  "user.role_change": "Change role",
  "user.department_change": "Change department",
  "user.profile_change": "Update employee profile",
  "user.badge_add": "Add badge",
  "user.badge_remove": "Remove badge",
  "permission.grant": "Grant permission",
  "permission.revoke": "Revoke permission",
  "permission.reset": "Reset permission to default",
  "project.create": "Create project",
  "project.update": "Update project",
  "project.delete": "Delete project",
  "project.status_change": "Change project status",
  "project.member_add": "Add project member",
  "project.member_remove": "Remove project member",
  "task.create": "Create task",
  "task.update": "Update task",
  "task.delete": "Delete task",
  "task.assignee_change": "Change task assignee",
  "task.status_change": "Change task status",
  "meeting.create": "Create meeting",
  "meeting.update": "Update meeting",
  "meeting.delete": "Delete meeting",
  "shoot.create": "Create photo shoot",
  "shoot.update": "Update photo shoot",
  "shoot.delete": "Delete photo shoot",
  "equipment.create": "Add equipment",
  "equipment.update": "Update equipment",
  "equipment.delete": "Delete equipment",
  "equipment.checkout": "Equipment check-out / return",
  "tx.create": "Add transaction",
  "tx.update": "Update transaction",
  "tx.delete": "Delete transaction",
  "client.create": "Add client",
  "client.update": "Update client",
  "client.delete": "Delete client",
  "backup.run": "Backup",
};

export function auditActionLabel(
  action: string,
  locale: "ar" | "en"
): string {
  const map = locale === "en" ? AUDIT_ACTION_LABEL_EN : AUDIT_ACTION_LABEL_AR;
  return (map as Record<string, string>)[action] ?? action;
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/projects/actions.ts`

<a id="app-projects-actions-ts"></a>

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requireDeptLeadOrAbove } from "@/lib/auth-guards";
import {
  safeAmount,
  safeInt,
  safeString,
  MAX_LONG_TEXT,
  MAX_NAME_LEN,
  MAX_SHORT_TEXT,
  MAX_TITLE_LEN,
} from "@/lib/input-limits";
import {
  findTemplate,
  templatePhaseNames,
  type Locale as TemplateLocale,
} from "@/lib/projects/phase-templates";
import { findOrCreateClientByName } from "@/app/clients/actions";

export async function createProjectAction(formData: FormData) {
  const user = await requireDeptLeadOrAbove();

  let title: string | null;
  let clientName: string | null;
  let brandName: string | null;
  let clientPhone: string | null;
  let description: string | null;
  let budgetQar: number;
  try {
    title = safeString(formData.get("title"), MAX_TITLE_LEN);
    clientName = safeString(formData.get("clientName"), MAX_NAME_LEN);
    brandName = safeString(formData.get("brandName"), MAX_NAME_LEN);
    clientPhone = safeString(formData.get("clientPhone"), MAX_SHORT_TEXT);
    description = safeString(formData.get("description"), MAX_LONG_TEXT);
    budgetQar = safeAmount(formData.get("budgetQar"));
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const type = (formData.get("type") as string | null) || null;
  const priority = (formData.get("priority") as string | null) || "normal";
  const deadlineAtRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt = deadlineAtRaw ? new Date(deadlineAtRaw) : null;
  const leadId = (formData.get("leadId") as string | null) || null;
  const billingType = (formData.get("billingType") as string | null) || "one_time";
  const billingCycleDays = safeInt(formData.get("billingCycleDays"), 30, 1, 365);

  if (!title) {
    return { ok: false, message: "اسم المشروع مطلوب" };
  }
  if (!["one_time", "monthly"].includes(billingType)) {
    return { ok: false, message: "نوع التسعير غير صحيح" };
  }

  // Auto-link or auto-create the client. If the form supplied an existing
  // clientId (combobox pick), prefer that — it skips name normalization and
  // avoids duplicating "Aspire" because the user typed "aspire ".
  let clientId: string | null = null;
  const explicitClientId = (formData.get("clientId") as string | null) || null;
  if (explicitClientId) {
    const exists = await prisma.client.findUnique({
      where: { id: explicitClientId },
      select: { id: true },
    });
    clientId = exists?.id ?? null;
  }
  if (!clientId && clientName) {
    // Pass the supplied phone through so a brand-new client gets it stamped
    // on creation rather than being orphaned without contact info.
    const c = await findOrCreateClientByName(clientName, { phone: clientPhone });
    clientId = c?.id ?? null;
  }

  // Sync brand + phone onto the client. Both follow the same rule: only
  // fill if the client doesn't already have a value. Never overwrite —
  // the explicit way to change a client's brand or phone is on the
  // /clients/[id] form. This prevents project entry from accidentally
  // erasing the agency's CRM record when a typo happens in the form.
  if (clientId && (brandName || clientPhone)) {
    const existing = await prisma.client.findUnique({
      where: { id: clientId },
      select: { brandName: true, phone: true },
    });
    if (existing) {
      const updates: { brandName?: string; phone?: string } = {};
      if (brandName && !existing.brandName) updates.brandName = brandName;
      if (clientPhone && !existing.phone) updates.phone = clientPhone;
      if (Object.keys(updates).length > 0) {
        await prisma.client.update({ where: { id: clientId }, data: updates });
      }
    }
  }

  // For monthly projects, schedule the first invoice exactly one cycle after
  // the project is entered. Each subsequent cycle advances from the date the
  // invoice is actually recorded (see recordInvoiceAction).
  const now = new Date();
  const nextInvoiceDueAt =
    billingType === "monthly"
      ? new Date(now.getTime() + billingCycleDays * 24 * 60 * 60 * 1000)
      : null;

  const project = await prisma.project.create({
    data: {
      title,
      clientId,
      brandName,
      type,
      priority,
      budgetQar,
      deadlineAt,
      description,
      leadId: leadId || user.id,
      billingType,
      billingCycleDays,
      nextInvoiceDueAt,
    },
  });

  // If the user picked a starter phase template, seed the phases now.
  const templateKey = (formData.get("phaseTemplate") as string | null) || null;
  const localeRaw = (formData.get("locale") as string | null) || "ar";
  const tplLocale: TemplateLocale = localeRaw === "en" ? "en" : "ar";
  if (templateKey) {
    const tpl = findTemplate(templateKey);
    if (tpl) {
      const names = templatePhaseNames(tpl, tplLocale);
      await prisma.$transaction(
        names.map((name, idx) =>
          prisma.projectPhase.create({
            data: {
              projectId: project.id,
              name,
              order: idx + 1,
              status: idx === 0 ? "active" : "locked",
            },
          })
        )
      );
    }
  }

  // Automatically add the lead as a project member.
  if (project.leadId) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: project.id, userId: project.leadId },
      },
      create: {
        projectId: project.id,
        userId: project.leadId,
        role: "lead",
      },
      update: {},
    });
  }

  await logAudit({
    action: "project.create",
    target: { type: "project", id: project.id, label: project.title },
    metadata: {
      budgetQar: project.budgetQar,
      billingType,
      priority,
      type,
      ...(billingType === "monthly"
        ? { billingCycleDays, firstInvoiceAt: nextInvoiceDueAt?.toISOString() }
        : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true, id: project.id };
}

export async function updateProjectAction(id: string, formData: FormData) {
  await requireDeptLeadOrAbove();

  let title: string | null;
  let description: string | null | undefined;
  let brandName: string | null | undefined;
  let budgetQar: number | undefined;
  try {
    title = safeString(formData.get("title"), MAX_TITLE_LEN);
    const rawDescription = formData.get("description");
    description =
      rawDescription === null
        ? undefined
        : safeString(rawDescription, MAX_LONG_TEXT);
    const rawBrand = formData.get("brandName");
    brandName = rawBrand === null ? undefined : safeString(rawBrand, MAX_NAME_LEN);
    const budgetRaw = formData.get("budgetQar");
    budgetQar = budgetRaw === null ? undefined : safeAmount(budgetRaw);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const status = (formData.get("status") as string | null) || undefined;
  const priority = (formData.get("priority") as string | null) || undefined;
  const deadlineAtRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt =
    deadlineAtRaw === null
      ? undefined
      : deadlineAtRaw === ""
      ? null
      : new Date(deadlineAtRaw);
  const progressRaw = formData.get("progressPct") as string | null;
  const progressPct = progressRaw ? parseInt(progressRaw) : undefined;
  const billingType = formData.get("billingType") as string | null;
  // `type` is one of the eight known values (or empty/—). We accept any
  // non-empty string so a future type added in the schema doesn't need a
  // code change here, but treat empty as "clear it".
  const typeRaw = formData.get("type");
  const typeUpdate: string | null | undefined =
    typeRaw === null ? undefined : typeRaw === "" ? null : String(typeRaw);

  const before = await prisma.project.findUnique({ where: { id } });

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(budgetQar !== undefined ? { budgetQar } : {}),
      ...(deadlineAt !== undefined ? { deadlineAt } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(brandName !== undefined ? { brandName } : {}),
      ...(typeUpdate !== undefined ? { type: typeUpdate } : {}),
      ...(progressPct !== undefined && !isNaN(progressPct)
        ? { progressPct: Math.max(0, Math.min(100, progressPct)) }
        : {}),
      ...(billingType && ["one_time", "monthly"].includes(billingType)
        ? { billingType }
        : {}),
      ...(status === "completed" ? { completedAt: new Date() } : {}),
    },
  });

  // Brand sync — if the user just set the project's brand AND the linked
  // client has no brand yet, propagate it to the client. Never overwrites.
  if (brandName && updated.clientId) {
    const c = await prisma.client.findUnique({
      where: { id: updated.clientId },
      select: { brandName: true },
    });
    if (c && !c.brandName) {
      await prisma.client.update({
        where: { id: updated.clientId },
        data: { brandName },
      });
    }
  }

  if (before && status && status !== before.status) {
    await logAudit({
      action: "project.status_change",
      target: { type: "project", id, label: updated.title },
      metadata: { from: before.status, to: status },
    });
  } else {
    await logAudit({
      action: "project.update",
      target: { type: "project", id, label: updated.title },
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProjectAction(id: string) {
  await requireDeptLeadOrAbove();
  const before = await prisma.project.findUnique({ where: { id } });
  await prisma.project.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "project.delete",
      target: { type: "project", id, label: before.title },
      metadata: { budgetQar: before.budgetQar, status: before.status },
    });
  }
  revalidatePath("/projects");
  redirect("/projects");
}

export async function addMemberAction(projectId: string, userId: string, role?: string) {
  await requireDeptLeadOrAbove();
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: role ?? null },
    update: { role: role ?? null },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeMemberAction(projectId: string, userId: string) {
  await requireDeptLeadOrAbove();
  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Monthly-invoice lifecycle
// ---------------------------------------------------------------------------

/**
 * Record this cycle's invoice as collected. Creates an income transaction using
 * the project's monthly budget, advances nextInvoiceDueAt by one cycle, and
 * clears this cycle's reminder flags so the next cycle fires fresh alerts.
 *
 * Permission: dept_lead+ only — recording invoices creates a financial
 * transaction, which is gated to the same tier as createTransactionAction.
 * (Previously this was open to any active user — a hole.)
 *
 * Idempotent enough that a double-click in the UI won't double-record — the
 * button disables itself during the transition.
 */
export async function recordInvoiceAction(projectId: string) {
  const user = await requireDeptLeadOrAbove();
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, message: "المشروع غير موجود" };
  if (project.billingType !== "monthly") {
    return { ok: false, message: "المشروع مو شهري" };
  }
  if (!project.budgetQar || project.budgetQar <= 0) {
    return { ok: false, message: "حدد مبلغ الفاتورة في الميزانية الشهرية" };
  }

  const now = new Date();
  // Next cycle anchors from what was due, not from now — that way a 2-day-late
  // collection doesn't shift the whole calendar 2 days forward.
  const anchor = project.nextInvoiceDueAt ?? now;
  const newDueAt = new Date(
    anchor.getTime() + project.billingCycleDays * 24 * 60 * 60 * 1000
  );

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        kind: "income",
        category: "project_payment",
        amountQar: project.budgetQar,
        description: `فاتورة شهرية · ${project.title}`,
        projectId: project.id,
        occurredAt: now,
        recurrence: "none",
        createdById: user.id,
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        lastInvoicedAt: now,
        nextInvoiceDueAt: newDueAt,
        invoiceReminderBeforeSentAt: null,
        invoiceReminderDueSentAt: null,
        invoiceReminderOverdueSentAt: null,
      },
    }),
  ]);

  await logAudit({
    action: "tx.create",
    target: {
      type: "project",
      id: project.id,
      label: `فاتورة شهرية: ${project.title}`,
    },
    metadata: {
      amountQar: project.budgetQar,
      dueAt: project.nextInvoiceDueAt?.toISOString(),
      nextDueAt: newDueAt.toISOString(),
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Mark a per-cycle reminder as fired so polling tabs don't double-alert.
 * `which`: "before" = 3 days before · "due" = day of · "overdue" = follow-up.
 *
 * Permission: dept_lead+ — marking invoice reminders ties into the financial
 * cycle (project budget visible on the project page), and we don't want
 * employees silencing reminders for projects they have no business with.
 * Owners/managers/dept_leads can mark; everyone else is rejected.
 */
export async function markInvoiceReminderSentAction(
  projectId: string,
  which: "before" | "due" | "overdue"
) {
  await requireDeptLeadOrAbove();
  const field =
    which === "before"
      ? "invoiceReminderBeforeSentAt"
      : which === "due"
      ? "invoiceReminderDueSentAt"
      : "invoiceReminderOverdueSentAt";
  await prisma.project.updateMany({
    where: { id: projectId, [field]: null },
    data: { [field]: new Date() },
  });
  return { ok: true };
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/meetings/actions.ts`

<a id="app-meetings-actions-ts"></a>

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import {
  requireActiveUser as requireAuth,
  requireDeptLeadOrAbove,
} from "@/lib/auth-guards";

function parseDateTime(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createMeetingAction(formData: FormData) {
  const user = await requireDeptLeadOrAbove();

  const clientName = (formData.get("clientName") as string | null)?.trim();
  const companyName = (formData.get("companyName") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim() || null;
  const instagramHandle = (formData.get("instagramHandle") as string | null)?.trim() || null;
  const tiktokHandle = (formData.get("tiktokHandle") as string | null)?.trim() || null;
  const websiteUrl = (formData.get("websiteUrl") as string | null)?.trim() || null;
  const socialNotes = (formData.get("socialNotes") as string | null)?.trim() || null;
  const meetingAt = parseDateTime(formData.get("meetingAt") as string | null);
  const durationRaw = formData.get("durationMin") as string | null;
  const durationMin = durationRaw ? parseInt(durationRaw) : 60;
  const location = (formData.get("location") as string | null)?.trim() || null;
  const meetingLink = (formData.get("meetingLink") as string | null)?.trim() || null;
  const agendaNotes = (formData.get("agendaNotes") as string | null)?.trim() || null;
  const rawOwnerId = (formData.get("ownerId") as string | null) || user.id;
  // Validate ownerId — must reference an active user. Falls back to the
  // creator if the supplied id is bogus or inactive.
  let ownerId = user.id;
  if (rawOwnerId && rawOwnerId !== user.id) {
    const owner = await prisma.user.findFirst({
      where: { id: rawOwnerId, active: true },
      select: { id: true },
    });
    ownerId = owner?.id ?? user.id;
  }

  if (!clientName) return { ok: false, message: "اسم العميل مطلوب" };
  if (!meetingAt) return { ok: false, message: "تاريخ ووقت الموعد مطلوبين" };

  const meeting = await prisma.clientMeeting.create({
    data: {
      clientName,
      companyName,
      phone,
      email,
      instagramHandle,
      tiktokHandle,
      websiteUrl,
      socialNotes,
      meetingAt,
      durationMin: Number.isNaN(durationMin) ? 60 : durationMin,
      location,
      meetingLink,
      agendaNotes,
      ownerId,
      createdById: user.id,
    },
  });

  // Confirmation push to the meeting owner — they know it's saved + scheduled
  // and the push reaches their phone right away. The 1-hour-before reminder
  // is fired separately by the server scheduler so it works even when the
  // page is closed. We notify the owner ALWAYS (even if they're the creator)
  // because the push delivery is the point — they need it on their phone.
  if (ownerId) {
    const { createNotification } = await import("@/lib/db/notifications");
    await createNotification({
      recipientId: ownerId,
      kind: "meeting.assigned",
      severity: "info",
      title: `📅 اجتماع جديد عليك — ${clientName}`,
      body: `${meetingAt.toLocaleString("ar")}${location ? ` · ${location}` : ""}`,
      linkUrl: "/meetings",
      refType: "meeting",
      refId: meeting.id,
    }).catch(() => null);
  }

  await logAudit({
    action: "meeting.create",
    target: {
      type: "meeting",
      id: meeting.id,
      label: `اجتماع: ${clientName}`,
    },
    metadata: {
      clientName,
      meetingAt: meetingAt.toISOString(),
      ownerId,
    },
  });

  revalidatePath("/meetings");
  revalidatePath("/");
  return { ok: true, id: meeting.id };
}

export async function updateMeetingAction(id: string, formData: FormData) {
  await requireDeptLeadOrAbove();

  const data: Record<string, unknown> = {};
  const fields = [
    "clientName",
    "companyName",
    "phone",
    "email",
    "instagramHandle",
    "tiktokHandle",
    "websiteUrl",
    "socialNotes",
    "location",
    "meetingLink",
    "agendaNotes",
    "outcomeNotes",
    "status",
    "ownerId",
  ] as const;

  for (const f of fields) {
    const v = formData.get(f);
    if (v === null) continue;
    const str = (v as string).trim();
    data[f] = str === "" ? null : str;
  }

  const meetingAtRaw = formData.get("meetingAt") as string | null;
  if (meetingAtRaw !== null) {
    const d = parseDateTime(meetingAtRaw);
    if (d) data.meetingAt = d;
  }
  const durationRaw = formData.get("durationMin") as string | null;
  if (durationRaw !== null && durationRaw !== "") {
    const n = parseInt(durationRaw);
    if (!Number.isNaN(n)) data.durationMin = n;
  }

  // If status changed to non-scheduled, clear reminderSentAt so it doesn't
  // accidentally fire again if un-cancelled. Leave it otherwise.
  if (data.status && data.status !== "scheduled") {
    data.reminderSentAt = null;
  }

  await prisma.clientMeeting.update({ where: { id }, data });

  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteMeetingAction(id: string) {
  await requireDeptLeadOrAbove();
  const before = await prisma.clientMeeting.findUnique({ where: { id } });
  await prisma.clientMeeting.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "project.delete",
      target: { type: "project", id, label: `اجتماع: ${before.clientName}` },
    });
  }
  revalidatePath("/meetings");
  return { ok: true };
}

/** Mark the 1-hour-before reminder as delivered. Idempotent.
 *
 * IDOR guard: only the meeting owner OR a manager+ can silence the reminder.
 * Without this, any active user could call markReminderSent for any meeting
 * id and suppress the alert for the actual owner.
 */
export async function markReminderSentAction(id: string) {
  const user = await requireAuth();
  const meeting = await prisma.clientMeeting.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!meeting) return { ok: false };

  const { isManagerOrAbove } = await import("@/lib/auth/roles");
  if (meeting.ownerId !== user.id && !isManagerOrAbove(user.role)) {
    return { ok: false };
  }

  await prisma.clientMeeting.updateMany({
    where: { id, reminderSentAt: null },
    data: { reminderSentAt: new Date() },
  });
  return { ok: true };
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/shoots/actions.ts`

<a id="app-shoots-actions-ts"></a>

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import {
  requireActiveUser as requireAuth,
  requireDeptLeadOrAbove,
} from "@/lib/auth-guards";

function parseDateTime(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIdCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createShootAction(formData: FormData) {
  const user = await requireDeptLeadOrAbove();

  const title = (formData.get("title") as string | null)?.trim();
  const shootDate = parseDateTime(formData.get("shootDate") as string | null);
  const durationRaw = formData.get("durationHours") as string | null;
  const durationHours = durationRaw ? parseFloat(durationRaw) : 4;
  const location = (formData.get("location") as string | null)?.trim();
  const locationNotes = (formData.get("locationNotes") as string | null)?.trim() || null;
  const mapUrl = (formData.get("mapUrl") as string | null)?.trim() || null;
  const projectId = (formData.get("projectId") as string | null) || null;
  const clientContact = (formData.get("clientContact") as string | null)?.trim() || null;
  const shotList = (formData.get("shotList") as string | null)?.trim() || null;
  const referenceUrl = (formData.get("referenceUrl") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const crewIds = parseIdCsv(formData.get("crewIds") as string | null);
  const equipmentIds = parseIdCsv(formData.get("equipmentIds") as string | null);

  if (!title) return { ok: false, message: "عنوان التصوير مطلوب" };
  if (!shootDate) return { ok: false, message: "تاريخ ووقت التصوير مطلوبين" };
  if (!location) return { ok: false, message: "الموقع مطلوب" };

  const shoot = await prisma.photoShoot.create({
    data: {
      title,
      shootDate,
      durationHours: Number.isNaN(durationHours) ? 4 : durationHours,
      location,
      locationNotes,
      mapUrl,
      projectId,
      clientContact,
      shotList,
      referenceUrl,
      notes,
      createdById: user.id,
      crew: {
        create: crewIds.map((uid) => ({ userId: uid })),
      },
      equipment: {
        create: equipmentIds.map((eid) => ({ equipmentId: eid })),
      },
    },
  });

  // Notify EVERY crew member (including the creator if they added themselves)
  // — the whole point is the push reaches their phone, even if they're
  // looking at the desktop right now. The 24h-before / 1h-before reminders
  // fire later via the server scheduler.
  if (crewIds.length > 0) {
    const { createNotificationMany } = await import("@/lib/db/notifications");
    await createNotificationMany(crewIds, {
      kind: "shoot.assigned",
      severity: "info",
      title: `📸 تصوير جديد عليك — ${title}`,
      body: `${shootDate.toLocaleString("ar")} · ${location}`,
      linkUrl: "/shoots",
      refType: "shoot",
      refId: shoot.id,
    });
  }

  await logAudit({
    action: "shoot.create",
    target: { type: "shoot", id: shoot.id, label: `تصوير: ${title}` },
    metadata: { shootDate: shootDate.toISOString(), crewCount: crewIds.length },
  });

  revalidatePath("/shoots");
  return { ok: true, id: shoot.id };
}

export async function updateShootAction(id: string, formData: FormData) {
  await requireDeptLeadOrAbove();

  const data: Record<string, unknown> = {};
  const stringFields = [
    "title",
    "location",
    "locationNotes",
    "mapUrl",
    "clientContact",
    "shotList",
    "referenceUrl",
    "notes",
    "status",
  ];
  for (const f of stringFields) {
    const v = formData.get(f);
    if (v === null) continue;
    const s = (v as string).trim();
    data[f] = s === "" ? null : s;
  }

  const projectId = formData.get("projectId") as string | null;
  if (projectId !== null) data.projectId = projectId || null;

  const shootDateRaw = formData.get("shootDate") as string | null;
  if (shootDateRaw !== null) {
    const d = parseDateTime(shootDateRaw);
    if (d) data.shootDate = d;
  }
  const durationRaw = formData.get("durationHours") as string | null;
  if (durationRaw !== null && durationRaw !== "") {
    const n = parseFloat(durationRaw);
    if (!isNaN(n)) data.durationHours = n;
  }

  // If status moves to non-scheduled, clear future reminder firings.
  if (data.status && data.status !== "scheduled") {
    data.reminderDayBeforeSentAt = null;
    data.reminderHourBeforeSentAt = null;
  }

  await prisma.photoShoot.update({ where: { id }, data });

  // Handle crew swap if provided
  const crewIdsRaw = formData.get("crewIds");
  if (crewIdsRaw !== null) {
    const crewIds = parseIdCsv(crewIdsRaw as string);
    await prisma.photoShootCrew.deleteMany({ where: { shootId: id } });
    if (crewIds.length > 0) {
      await prisma.photoShootCrew.createMany({
        data: crewIds.map((uid) => ({ shootId: id, userId: uid })),
      });
    }
  }
  // Same for equipment
  const equipmentIdsRaw = formData.get("equipmentIds");
  if (equipmentIdsRaw !== null) {
    const equipmentIds = parseIdCsv(equipmentIdsRaw as string);
    await prisma.photoShootEquipment.deleteMany({ where: { shootId: id } });
    if (equipmentIds.length > 0) {
      await prisma.photoShootEquipment.createMany({
        data: equipmentIds.map((eid) => ({ shootId: id, equipmentId: eid })),
      });
    }
  }

  revalidatePath("/shoots");
  return { ok: true };
}

export async function deleteShootAction(id: string) {
  await requireDeptLeadOrAbove();
  const before = await prisma.photoShoot.findUnique({ where: { id } });
  await prisma.photoShoot.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "project.delete",
      target: { type: "project", id, label: `تصوير: ${before.title}` },
    });
  }
  revalidatePath("/shoots");
  return { ok: true };
}

// Helper: only crew members (or manager+) can silence a shoot reminder.
// Otherwise anyone with a shoot id could suppress alerts for the photographer.
async function assertCrewOrManager(shootId: string, userId: string, userRole: string) {
  const { isManagerOrAbove } = await import("@/lib/auth/roles");
  if (isManagerOrAbove(userRole)) return true;
  const crew = await prisma.photoShootCrew.findUnique({
    where: { shootId_userId: { shootId, userId } },
    select: { shootId: true },
  });
  return !!crew;
}

/** Idempotent — marks the 24h-before reminder as sent. Crew or manager+ only. */
export async function markShootDayReminderSentAction(id: string) {
  const user = await requireAuth();
  if (!(await assertCrewOrManager(id, user.id, user.role))) return { ok: false };
  await prisma.photoShoot.updateMany({
    where: { id, reminderDayBeforeSentAt: null },
    data: { reminderDayBeforeSentAt: new Date() },
  });
  return { ok: true };
}

/** Idempotent — marks the 1h-before reminder as sent. Crew or manager+ only. */
export async function markShootHourReminderSentAction(id: string) {
  const user = await requireAuth();
  if (!(await assertCrewOrManager(id, user.id, user.role))) return { ok: false };
  await prisma.photoShoot.updateMany({
    where: { id, reminderHourBeforeSentAt: null },
    data: { reminderHourBeforeSentAt: new Date() },
  });
  return { ok: true };
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/shoots/[id]/page.tsx`

<a id="app-shoots--id--page-tsx"></a>

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Clock,
  MapPin,
  Users,
  Package,
  ExternalLink,
  Briefcase,
  FileText,
  Phone,
  Calendar as CalIcon,
  Download,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";
import { ShootActions } from "../shoot-actions";
import { isDeptLeadOrAbove } from "@/lib/auth/roles";

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-zinc-700/40 text-zinc-400 border-zinc-700",
  postponed: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const CONDITION_STYLE: Record<string, string> = {
  new: "text-emerald-400",
  good: "text-sky-400",
  fair: "text-amber-400",
  needs_repair: "text-orange-400",
  broken: "text-rose-400",
};

/**
 * Turn a Google Maps URL into an embeddable iframe src.
 *
 * Strategy:
 *   1. If the user pasted a maps.app.goo.gl short link OR a maps.google.com
 *      URL with explicit lat/lng, we embed THAT — preserves the exact pin
 *      they shared.
 *   2. Otherwise we fall back to a search query of the text location, which
 *      always works without a Google API key.
 *
 * `output=embed` is the public, key-less embed mode — same one Google's own
 * "Share → Embed a map" dialog generates.
 */
function buildMapEmbed(rawLocation: string, mapUrl: string | null): string {
  // 1. Pin-preserving path — explicit short link or coords URL.
  if (mapUrl) {
    try {
      const u = new URL(mapUrl);
      // Short link from the Google Maps mobile share sheet — can't be parsed
      // for coords, but the embed iframe will follow the redirect and show
      // the pinned location.
      if (
        u.hostname === "maps.app.goo.gl" ||
        u.hostname === "goo.gl" ||
        u.hostname === "g.co"
      ) {
        return `https://www.google.com/maps?q=${encodeURIComponent(mapUrl)}&output=embed`;
      }
      // Already an embed URL — pass through.
      if (u.searchParams.get("output") === "embed") {
        return mapUrl;
      }
      // Standard maps.google.com URL with q= or @lat,lng.
      if (u.hostname.endsWith("google.com") && u.pathname.startsWith("/maps")) {
        const q = u.searchParams.get("q");
        if (q) return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
        const atMatch = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (atMatch) {
          return `https://www.google.com/maps?q=${atMatch[1]},${atMatch[2]}&output=embed`;
        }
      }
    } catch {
      // mapUrl wasn't a parseable URL — fall through to text search
    }
  }

  // 2. Text-search fallback — always renders something useful.
  const q = encodeURIComponent(rawLocation);
  return `https://www.google.com/maps?q=${q}&output=embed`;
}

export default async function ShootDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const user = session?.user;
  if (!user) return null;
  const canManage = isDeptLeadOrAbove(user.role);

  const shoot = await prisma.photoShoot.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true } },
      crew: {
        include: {
          user: {
            select: { id: true, name: true, email: true, jobTitle: true, role: true },
          },
        },
      },
      equipment: {
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
              category: true,
              brand: true,
              model: true,
              condition: true,
            },
          },
        },
      },
    },
  });

  if (!shoot) notFound();

  const now = new Date();
  const msUntil = shoot.shootDate.getTime() - now.getTime();
  const isUpcoming = shoot.status === "scheduled" && msUntil > 0;
  const isToday =
    shoot.shootDate.getDate() === now.getDate() &&
    shoot.shootDate.getMonth() === now.getMonth() &&
    shoot.shootDate.getFullYear() === now.getFullYear();

  const [users, projects, equipment] = canManage
    ? await Promise.all([
        prisma.user.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.project.findMany({
          where: { status: { in: ["active", "on_hold"] } },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
        }),
        prisma.equipment.findMany({
          select: { id: true, name: true, category: true },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        }),
      ])
    : [[], [], []];

  const mapSrc = buildMapEmbed(shoot.location, shoot.mapUrl);
  const endsAt = new Date(
    shoot.shootDate.getTime() + shoot.durationHours * 3600_000
  );

  return (
    <div className="space-y-5">
      <Link
        href="/shoots"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowRight className="h-3 w-3" />
        {t("shoots.backToAll")}
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Camera
                className="h-4 w-4"
                style={{ color: "var(--color-brand)" }}
              />
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  STATUS_STYLE[shoot.status] ?? "border-zinc-700 text-zinc-400"
                )}
              >
                {t(`shoots.status.${shoot.status}`)}
              </span>
              {isToday && isUpcoming && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  ⚡ {t("shoots.today")}
                </span>
              )}
              {shoot.project && (
                <Link
                  href={`/projects/${shoot.project.id}`}
                  className="flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-sky-400 hover:bg-zinc-800"
                >
                  <Briefcase className="h-2.5 w-2.5" />
                  {shoot.project.title}
                </Link>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-zinc-100">
              {shoot.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/shoots/${shoot.id}/ics`}
              download={`shoot-${shoot.id}.ics`}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5" />
              {t("shoots.addToCalendar")}
            </a>
            {/* Generate a print-friendly call sheet — opens in a new tab so the
                user can hit Cmd/Ctrl+P and save as PDF or print straight to
                paper for the crew. */}
            <Link
              href={`/shoots/${shoot.id}/call-sheet`}
              target="_blank"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-300 hover:border-emerald-400/50"
            >
              <FileText className="h-3.5 w-3.5" />
              {locale === "ar" ? "كول شيت" : "Call sheet"}
            </Link>
            {canManage && (
              <ShootActions
                shoot={{
                  id: shoot.id,
                  title: shoot.title,
                  projectId: shoot.projectId,
                  shootDate: shoot.shootDate,
                  durationHours: shoot.durationHours,
                  location: shoot.location,
                  locationNotes: shoot.locationNotes,
                  mapUrl: shoot.mapUrl,
                  clientContact: shoot.clientContact,
                  shotList: shoot.shotList,
                  referenceUrl: shoot.referenceUrl,
                  notes: shoot.notes,
                  status: shoot.status,
                  crew: shoot.crew.map((c) => ({
                    user: { id: c.user.id, name: c.user.name },
                  })),
                  equipment: shoot.equipment.map((e) => ({
                    equipment: {
                      id: e.equipment.id,
                      name: e.equipment.name,
                      category: e.equipment.category,
                    },
                  })),
                }}
                users={users}
                projects={projects}
                equipment={equipment}
              />
            )}
          </div>
        </div>

        {/* Key stats row */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-800 pt-4 md:grid-cols-3">
          <InfoBlock
            icon={CalIcon}
            label={t("shoots.field.date")}
            primary={shoot.shootDate.toLocaleString(
              locale === "en" ? "en-US" : "en",
              {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }
            )}
            secondary={`⏱ ${shoot.durationHours}${t(
              "shoots.hoursShort"
            )} · ${t("shoots.endsAt")} ${endsAt.toLocaleTimeString(
              locale === "en" ? "en-US" : "en",
              { hour: "2-digit", minute: "2-digit", hour12: true }
            )}`}
          />
          <InfoBlock
            icon={Users}
            label={t("shoots.field.crew")}
            primary={`${shoot.crew.length} ${t("shoots.crewCount")}`}
            secondary={
              shoot.crew.length > 0
                ? shoot.crew.map((c) => c.user.name).join(" · ")
                : t("shoots.noCrew")
            }
          />
          <InfoBlock
            icon={Package}
            label={t("shoots.field.equipment")}
            primary={`${shoot.equipment.length} ${t("shoots.itemsCount")}`}
            secondary={
              shoot.equipment.length > 0
                ? shoot.equipment.map((e) => e.equipment.name).join(" · ")
                : t("shoots.noEquipment")
            }
          />
        </div>
      </div>

      {/* Location + Map */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <MapPin
                className="h-4 w-4"
                style={{ color: "var(--color-brand)" }}
              />
              {t("shoots.field.location")}
            </div>
            <div className="text-lg font-semibold text-zinc-100">
              {shoot.location}
            </div>
            {shoot.locationNotes && (
              <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
                📍 {shoot.locationNotes}
              </div>
            )}
            {shoot.clientContact && (
              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
                <Phone
                  className="h-3 w-3"
                  style={{ color: "var(--color-accent)" }}
                />
                {shoot.clientContact}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {shoot.mapUrl && (
                <a
                  href={shoot.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:opacity-90"
                  style={{ background: "var(--color-brand)" }}
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("shoots.openInMaps")}
                </a>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  shoot.location
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                <MapPin className="h-3 w-3" />
                {t("shoots.getDirections")}
              </a>
            </div>
          </div>
        </div>

        {/* Embedded map — uses text location as search query (works without an API key) */}
        <div className="lg:col-span-3">
          <div className="h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <iframe
              title="Map"
              src={mapSrc}
              className="h-full min-h-[240px] w-full"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>

      {/* Crew detail */}
      {shoot.crew.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Users
              className="h-4 w-4"
              style={{ color: "var(--color-brand)" }}
            />
            {t("shoots.field.crew")} · {shoot.crew.length}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shoot.crew.map((c) => (
              <Link
                key={c.user.id}
                href={`/team/${c.user.id}`}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                  {c.user.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-100">
                    {c.user.name}
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {c.user.jobTitle ?? t(`role.${c.user.role}`)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Equipment detail */}
      {shoot.equipment.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Package
              className="h-4 w-4"
              style={{ color: "var(--color-brand)" }}
            />
            {t("shoots.field.equipment")} · {shoot.equipment.length}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shoot.equipment.map((e) => (
              <div
                key={e.equipment.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-100">
                      {e.equipment.name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      {[e.equipment.brand, e.equipment.model]
                        .filter(Boolean)
                        .join(" · ") || t(`equipment.category.${e.equipment.category}`)}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[10px]",
                      CONDITION_STYLE[e.equipment.condition] ?? "text-zinc-500"
                    )}
                  >
                    {t(`equipment.condition.${e.equipment.condition}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shot list */}
      {shoot.shotList && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <FileText
              className="h-4 w-4"
              style={{ color: "var(--color-brand)" }}
            />
            {t("shoots.field.shotList")}
          </div>
          <div className="whitespace-pre-wrap text-sm text-zinc-300">
            {shoot.shotList}
          </div>
        </section>
      )}

      {/* Reference */}
      {shoot.referenceUrl && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-2 text-sm font-semibold text-zinc-200">
            {t("shoots.openReference")}
          </div>
          <a
            href={shoot.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: "var(--color-accent)" }}
          >
            <ExternalLink className="h-4 w-4" />
            {shoot.referenceUrl}
          </a>
        </section>
      )}

      {/* Notes */}
      {shoot.notes && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-2 text-sm font-semibold text-zinc-200">
            {t("shoots.field.notes")}
          </div>
          <div className="whitespace-pre-wrap text-sm text-zinc-300">
            {shoot.notes}
          </div>
        </section>
      )}

      {/* Reminder status */}
      {shoot.status === "scheduled" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 text-sm font-semibold text-zinc-200">
            {t("shoots.reminders.title")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReminderStatus
              label={t("shoots.reminders.dayBefore")}
              sentAt={shoot.reminderDayBeforeSentAt}
              t={t}
              locale={locale}
            />
            <ReminderStatus
              label={t("shoots.reminders.hourBefore")}
              sentAt={shoot.reminderHourBeforeSentAt}
              t={t}
              locale={locale}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  primary,
  secondary,
}: {
  icon: typeof Clock;
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{primary}</div>
      {secondary && (
        <div className="mt-0.5 text-[11px] text-zinc-500">{secondary}</div>
      )}
    </div>
  );
}

function ReminderStatus({
  label,
  sentAt,
  t,
  locale,
}: {
  label: string;
  sentAt: Date | null;
  t: (k: string) => string;
  locale: "ar" | "en";
}) {
  if (sentAt) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-emerald-300">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="text-xs font-semibold">{label}</div>
          <div className="text-[11px] opacity-80">
            {t("shoots.reminders.sentAt")}{" "}
            {new Date(sentAt).toLocaleString(
              locale === "en" ? "en-US" : "en",
              { hour: "2-digit", minute: "2-digit", hour12: true, day: "numeric", month: "short" }
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-400">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-[11px] text-zinc-500">
          {t("shoots.reminders.pending")}
        </div>
      </div>
    </div>
  );
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/api/projects/billing-due/route.ts`

<a id="app-api-projects-billing-due-route-ts"></a>

```typescript
// Polled by the InvoiceReminder client component every 30s.
// Returns monthly projects whose invoice is in one of 3 alert windows:
//   before   — 2.5 to 3.5 days before due  (soft reminder)
//   due      — same calendar day (due today)
//   overdue  — >= 1 day past due and still not collected
// Each window fires only once per cycle — the per-cycle reminder fields on
// the Project track that, and are wiped when recordInvoiceAction advances the
// cycle.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { isDeptLeadOrAbove } from "@/lib/auth/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Billing data exposes client names + monthly project budgets — that's
  // financial information that plain employees shouldn't see. Restrict to
  // dept_lead and above (same tier that can record transactions).
  if (!isDeptLeadOrAbove(session.user.role)) {
    return NextResponse.json({ before: [], due: [], overdue: [], now: new Date().toISOString() });
  }

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const candidates = await prisma.project.findMany({
    where: {
      billingType: "monthly",
      status: "active",
      nextInvoiceDueAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      budgetQar: true,
      billingCycleDays: true,
      nextInvoiceDueAt: true,
      invoiceReminderBeforeSentAt: true,
      invoiceReminderDueSentAt: true,
      invoiceReminderOverdueSentAt: true,
      client: { select: { name: true } },
    },
  });

  const before: typeof candidates = [];
  const due: typeof candidates = [];
  const overdue: typeof candidates = [];

  for (const p of candidates) {
    if (!p.nextInvoiceDueAt) continue;
    const diffMs = p.nextInvoiceDueAt.getTime() - now.getTime();
    const diffDays = diffMs / dayMs;

    // 3-day-before window: between 2.5 and 3.5 days ahead.
    if (
      !p.invoiceReminderBeforeSentAt &&
      diffDays > 2.5 &&
      diffDays <= 3.5
    ) {
      before.push(p);
    }

    // Due-today window: invoice date within today (any moment today before
    // flipping past the due moment by a calendar day).
    if (
      !p.invoiceReminderDueSentAt &&
      diffDays <= 0.5 &&
      diffDays > -1
    ) {
      due.push(p);
    }

    // Overdue: >= 1 full day past due.
    if (!p.invoiceReminderOverdueSentAt && diffDays <= -1) {
      overdue.push(p);
    }
  }

  return NextResponse.json({
    before,
    due,
    overdue,
    now: now.toISOString(),
  });
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `app/api/tasks/suggest-assignees/route.ts`

<a id="app-api-tasks-suggest-assignees-route-ts"></a>

```typescript
// Smart assignee suggestions for the new-task modal.
// POST { title, description?, projectId?, requiredBadgeSlugs? }
//   → { suggestions, inferredBadgeSlugs, filteredByBadge }
//
// Available to anyone who can create tasks (any active user). The response
// strips sensitive fields (email, department, role) so a regular employee
// using the suggestion picker doesn't end up with a full directory dump in
// their browser's network tab. Manager+ surfaces continue to use the page-
// level user list (already gated server-side) for the full profile data.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { suggestAssignees } from "@/lib/tasks/suggest-assignees";
import { isManagerOrAbove } from "@/lib/auth/roles";

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

  // Strip sensitive PII from the suggestion payload for non-manager callers.
  // Managers / owners get the full record (they already have it elsewhere).
  if (!isManagerOrAbove(session.user.role)) {
    result.suggestions = result.suggestions.map((s) => ({
      ...s,
      user: {
        id: s.user.id,
        name: s.user.name,
        email: "",
        jobTitle: s.user.jobTitle,
        department: null,
        role: "employee",
      },
    }));
  }

  return NextResponse.json(result);
}

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `update-and-run.bat`

<a id="update-and-run-bat"></a>

```batch
@echo off
REM ============================================================
REM SRB — One-click updater + launcher for Windows
REM Double-click this file to:
REM   1. Pull the latest changes from GitHub
REM   2. Install any new dependencies
REM   3. Push schema changes to the local SQLite DB
REM   4. Start the dev server on http://localhost:3000
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo  SRB System — Update and Launch
echo ============================================================
echo.
echo  Working directory: %CD%
echo.

REM --- 1. Pull latest changes ---------------------------------
echo [1/4] Pulling latest changes from GitHub...
git fetch origin
if errorlevel 1 (
    echo.
    echo  Git fetch failed. Check your internet connection.
    pause
    exit /b 1
)

REM Default to the audit branch unless the user is already on a different one.
git rev-parse --abbrev-ref HEAD > "%TEMP%\srb_branch.txt"
set /p CURRENT_BRANCH=<"%TEMP%\srb_branch.txt"
del "%TEMP%\srb_branch.txt"

if "%CURRENT_BRANCH%"=="main" (
    echo  Switching from main to claude/audit-internal-system-jQ6er...
    git checkout claude/audit-internal-system-jQ6er
)

git pull --ff-only origin claude/audit-internal-system-jQ6er
if errorlevel 1 (
    echo.
    echo  Git pull failed. If you have local changes, commit or stash them first.
    pause
    exit /b 1
)

echo.

REM --- 2. Install dependencies --------------------------------
echo [2/4] Installing dependencies (this may take 1-2 minutes)...
call npm install
if errorlevel 1 (
    echo.
    echo  npm install failed. Make sure Node.js 20+ is installed.
    echo  Download from: https://nodejs.org
    pause
    exit /b 1
)

echo.

REM --- 3. Sync the SQLite schema (Notification + Task reminders) -
echo [3/4] Syncing database schema...
call npx prisma db push --skip-generate
if errorlevel 1 (
    echo.
    echo  Prisma db push failed. Check that .env.local has DATABASE_URL set.
    pause
    exit /b 1
)

echo.

REM --- 4. Start the dev server --------------------------------
echo [4/4] Starting dev server on http://localhost:3000 ...
echo.
echo  ============================================================
echo   System is starting. Open http://localhost:3000 in Chrome.
echo   To stop the server, press Ctrl+C in this window.
echo  ============================================================
echo.

call npm run dev

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## `.env.local.example`

<a id="-env-local-example"></a>

```
# ============================================
# SRB Simulator — Local Environment
# ============================================
# Copy this file to `.env.local` and fill in the values.
# `.env.local` is gitignored so your secrets stay on your machine.

# Auth.js random secret — generate with any of these:
#   Windows PowerShell:  [Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Max 256}))
#   Mac/Linux:           openssl rand -hex 32
#   Or use any random 32+ character string
AUTH_SECRET=CHANGE_ME_TO_RANDOM_STRING_32_CHARS_OR_MORE

# Google OAuth credentials
# Get these from https://console.cloud.google.com
# → APIs & Services → Credentials → OAuth 2.0 Client IDs
# Authorized redirect URI must be: http://localhost:3000/api/auth/callback/google
AUTH_GOOGLE_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=YOUR_CLIENT_SECRET

# On first run only — the Gmail address that gets seeded as the admin.
# After first login, you can manage users from /admin/users.
ADMIN_EMAIL=your.email@gmail.com
ADMIN_NAME=Admin

# Trust the host header (set in dev; set to explicit URL in production)
AUTH_TRUST_HOST=true

# ============================================
# Web Push (mobile + desktop notifications when the tab is closed)
# ============================================
# Generate the keypair ONE TIME with:
#   node scripts/generate-vapid-keys.mjs
# Copy the printed values into Railway → Variables (or here for local dev).
#
# Public key is safe to expose. Private key MUST stay secret.
# Subject is just a contact for push providers — any mailto: is fine.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@srb.network

```

[⬆ العودة للأعلى](#%D9%85%D9%84%D9%81%D8%A7%D8%AA-%D9%86%D8%B8%D8%A7%D9%85-srb--%D9%87%D8%B0%D9%8A-%D8%A7%D9%84%D8%AC%D9%84%D8%B3%D8%A9)

---

## ملاحظات

- النسخ الموجودة هنا هي **الحالية في فرع main** (5967bb8)
- بعض الملفات اتعدّلت لاحقاً من قبل أحد آخر بعد جلستنا — وضحت ذلك في هذا الملف بحيث تشوف النسخة الفعلية المنشورة على srb.network
- الفرع اللي فيه هذا الملف: `claude/bundle-srb-files`
