import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.COURSE_CRAFT_NEXT_DIST_DIR ?? (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  // Keep Node-only parsers and Mastra out of the bundler.
  serverExternalPackages: ["pdf-parse", "mammoth", "@napi-rs/canvas", "@mastra/*"],
};

export default nextConfig;
