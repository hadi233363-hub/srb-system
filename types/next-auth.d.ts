import type { DefaultSession } from "next-auth";

type Role = "admin" | "manager" | "department_head" | "employee";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      department: string | null;
      active: boolean;
      approved: boolean; // approvedAt is not null
      nickname: string | null;
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
    nickname?: string | null;
  }
}
