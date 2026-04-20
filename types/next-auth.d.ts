import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "manager" | "employee";
      department: string | null;
      active: boolean;
      approved: boolean; // approvedAt is not null
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "admin" | "manager" | "employee";
    department?: string | null;
    active?: boolean;
    approved?: boolean;
  }
}
