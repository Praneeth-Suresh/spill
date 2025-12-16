import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default {
  schema: "./drizzle/schema.ts",
  // Emit SQL files directly to mysql-init so MySQL can run them at container init
  out: "./drizzle/migrations", // "./mysql-init",
  dialect: "mysql",
  // MySQL entrypoint doesn't understand Drizzle's "--> statement-breakpoint" markers
  // so disable them in generated SQL.
  // breakpoints: false,
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;