import { execSync } from "node:child_process";

/*
 * Where the local test stack is (`supabase start` in the repo root): its database, auth API, publishable key and
 * test mailbox. Read from the environment when set (CI sets them), otherwise from `supabase status`.
 * These are the local stack's well-known defaults, never the real project's.
 */
export type LocalStack = {
  dbUrl: string;
  apiUrl: string;
  publishableKey: string;
  /** The local stack's secret key: only setup uses it, to create the test user and its sign-in link */
  secretKey: string;
  mailboxUrl: string;
};

let cached: LocalStack | undefined;

export function localStack(): LocalStack {
  if (cached) return cached;
  let vars: Record<string, string> = {};
  if (!process.env.SUPABASE_DB_URL) {
    try {
      const out = execSync("supabase status -o env", { cwd: `${__dirname}/../../..`, stdio: ["ignore", "pipe", "ignore"] }).toString();
      vars = Object.fromEntries(
        out
          .split("\n")
          .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim()))
          .filter((m): m is RegExpExecArray => !!m)
          .map((m) => [m[1], m[2]])
      );
    } catch {
      throw new Error("The local Supabase isn't running. Start it from the repo root with: supabase start");
    }
  }
  cached = {
    dbUrl: process.env.SUPABASE_DB_URL ?? vars.DB_URL,
    apiUrl: process.env.SUPABASE_API_URL ?? vars.API_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? vars.PUBLISHABLE_KEY ?? vars.ANON_KEY,
    secretKey: process.env.SUPABASE_SECRET_KEY ?? vars.SECRET_KEY ?? vars.SERVICE_ROLE_KEY,
    mailboxUrl: process.env.SUPABASE_MAILBOX_URL ?? vars.MAILPIT_URL ?? vars.INBUCKET_URL,
  };
  for (const [key, value] of Object.entries(cached)) {
    if (!value) throw new Error(`Missing ${key} for the local Supabase stack`);
    // Never seed a real database or use a real project's keys by mistake
    if (key === "dbUrl" && !/@(127\.0\.0\.1|localhost):/.test(value)) throw new Error("The tests only run against a local database");
    if (key === "apiUrl" && !/^http:\/\/(127\.0\.0\.1|localhost):/.test(value)) throw new Error("The tests only run against a local Supabase");
  }
  return cached;
}
