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
