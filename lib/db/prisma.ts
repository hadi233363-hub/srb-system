import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// SQLite tuning for better concurrency + write performance.
// NOTE: PRAGMA statements return a result row, so $queryRawUnsafe is required.
// $executeRawUnsafe throws "Execute returned results, which is not allowed in SQLite."
void prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {});
void prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;").catch(() => {});
