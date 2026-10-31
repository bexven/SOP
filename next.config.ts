import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the app portable: the same build runs on Vercel
  // today and on a plain Node server (VPS) later without code changes.
  output: "standalone",

  // Cache Components is deliberately OFF. Every page in this app is
  // authenticated and request-specific, so we use the classic dynamic model.
  // See CLAUDE.md → "Rendering model".
  cacheComponents: false,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  poweredByHeader: false,
};

export default nextConfig;
