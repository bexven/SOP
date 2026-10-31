import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (migrate, studio, seed) uses the DIRECT (non-pooled) connection.
// The app at runtime uses the pooled DATABASE_URL via the pg driver adapter
// (see src/lib/server/db.ts).
// DATABASE_URL_UNPOOLED is what Vercel's Neon integration sets automatically
// (including per-preview database branches), so it is accepted as a fallback.
// `prisma generate` does not need a database, so a missing URL is tolerated.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
