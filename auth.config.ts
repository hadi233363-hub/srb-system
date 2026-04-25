// Edge-safe Auth.js config used by proxy.ts (Next.js 16 middleware).
// No DB access here — better-sqlite3 is a native module and doesn't work at the edge.
//
// The full DB-backed jwt/session callbacks live in auth.ts; this file only maps
// what's already in the JWT onto req.auth.user so the proxy can do RBAC without
// a DB roundtrip.

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export default {
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.role =
          (token.role as "admin" | "manager" | "employee") ?? "employee";
        session.user.active = (token.active as boolean | undefined) ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
