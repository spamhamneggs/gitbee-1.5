import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: `tsx ${path.join(import.meta.dirname, "prisma/seed.ts").replaceAll(" ", "\\ ")}`,
  },
  datasource: { url: process.env.DATABASE_URL as string },
});
