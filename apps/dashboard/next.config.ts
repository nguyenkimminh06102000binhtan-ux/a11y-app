import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  // The tests build into their own folder, so they never replace your dev or production build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  transpilePackages: ["@app/db", "@app/widget-config", "@app/observability"],
  partialPrefetching: true,
  // A site opens on its Audit section; keeps old /sites/:id links and bookmarks working
  async redirects() {
    return [{ source: "/sites/:id", destination: "/sites/:id/audit", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

/*
 * Sentry's build step uploads source maps (readable stack traces) when SENTRY_AUTH_TOKEN, SENTRY_ORG and
 * SENTRY_PROJECT are set (Vercel), then deletes them so they're never served. Without them (dev, tests, CI) it
 * uploads nothing. Tracing code is left out of the bundle: errors only.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false, // no usage data about our builds to Sentry
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
  bundleSizeOptimizations: { excludeDebugStatements: true, excludeTracing: true },
});
