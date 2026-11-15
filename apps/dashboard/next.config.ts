import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // The tests build into their own folder, so they never replace your dev or production build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  transpilePackages: ["@app/db", "@app/widget-config"],
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

export default nextConfig;
