import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// `.env.local` first — that is where `vercel env pull` writes, and where the
// Neon connection string lives. Plain `dotenv/config` only reads `.env`, so
// without this `db:migrate` would silently target nothing.
loadEnv({ path: ".env.local" });
loadEnv();

/**
 * Migrations are generated, reviewed and committed — never pushed straight to
 * a live database. `drizzle-kit push` is convenient and will happily drop a
 * column full of registrations.
 *
 *   npm run db:generate   # write a migration from schema.ts
 *   npm run db:migrate    # apply pending migrations
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
