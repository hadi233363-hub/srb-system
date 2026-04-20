// Edge-safe Auth.js config used by proxy.ts (Next.js 16 middleware).
// No DB access here — better-sqlite3 is a native module and doesn't work at the edge.

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export default {
  providers: [Google],
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
