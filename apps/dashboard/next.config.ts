import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
