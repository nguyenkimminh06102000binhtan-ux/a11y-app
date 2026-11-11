import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.MIGRATION_URL!,
  },
  strict: true,  // asks before running anything destructive (like dropping a column)
  verbose: true, // prints the SQL it runs
});