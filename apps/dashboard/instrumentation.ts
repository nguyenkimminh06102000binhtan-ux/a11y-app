import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

/** Server and edge error reporting (lib/sentry-options.ts). Runs once when the server starts. */
export function register() {
    Sentry.init(sentryOptions(process.env.VERCEL_ENV));
}

/** Errors in pages, server actions and route handlers (Next's hook). */
export const onRequestError = Sentry.captureRequestError;
