import { PrismaClient } from "@prisma/client";

// Serverless-safe singleton pattern (prevents exhausting Neon connections
// during Next.js hot-reload / multiple lambda invocations on Vercel).
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
