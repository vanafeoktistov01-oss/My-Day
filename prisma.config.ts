import { defineConfig } from "prisma/config";

// Load .env for local development only; in Docker/Railway env vars come from the platform.
try {
  process.loadEnvFile();
} catch {
  // no .env file present
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // prisma generate does not connect to the DB; use a placeholder when DATABASE_URL is not set at build time.
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
