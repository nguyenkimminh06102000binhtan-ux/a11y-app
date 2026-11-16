import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

// Browser error reporting (lib/sentry-options.ts). Vercel exposes NEXT_PUBLIC_VERCEL_ENV to the browser.
Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_VERCEL_ENV));
