// Prisma-backed User functions. Replaces lib/auth/users.ts going forward.
// The Auth.js callbacks still use lib/auth/users.ts (better-sqlite3) for now —
// we'll migrate that in the next pass. For now, Prisma is the truth for the app.

import { prisma } from "./prisma";
import type { User } from "@prisma/client";

export type { User };

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

export async function listUsers(options?: {
  activeOnly?: boolean;
  department?: string;
}): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      ...(options?.activeOnly ? { active: true } : {}),
      ...(options?.department ? { department: options.department } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Same as listUsers but eagerly loads each user's badges. Used by the admin
 * page (to render badge chips) and the team profile (to display them).
 */
export async function listUsersWithBadges(options?: {
  activeOnly?: boolean;
  department?: string;
}) {
  return prisma.user.findMany({
    where: {
      ...(options?.activeOnly ? { active: true } : {}),
      ...(options?.department ? { department: options.department } : {}),
    },
    include: {
      badges: {
        include: { badge: true },
        orderBy: { badge: { sortOrder: "asc" } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createUser(input: {
  email: string;
  name: string;
  role: "admin" | "manager" | "department_head" | "employee";
  department?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  salaryQar?: number | null;
  hiredAt?: Date | null;
  nickname?: string | null;
}): Promise<User> {
  return prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: input.role,
      department: input.department ?? null,
      jobTitle: input.jobTitle ?? null,
      phone: input.phone ?? null,
      salaryQar: input.salaryQar ?? null,
      hiredAt: input.hiredAt ?? null,
      nickname: input.nickname ?? null,
    },
  });
}

export async function updateUser(
  id: string,
  patch: Partial<
    Pick<
      User,
      | "name"
      | "nickname"
      | "role"
      | "department"
      | "active"
      | "jobTitle"
      | "phone"
      | "salaryQar"
      | "hiredAt"
      | "avatarUrl"
    >
  >
): Promise<User> {
  return prisma.user.update({ where: { id }, data: patch });
}

export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}

export async function touchLogin(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}
