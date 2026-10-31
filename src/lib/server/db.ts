import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

// One client per server instance. In dev, reuse across hot reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Pooled connection (Neon pooler on Vercel, plain Postgres on a VPS).
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
