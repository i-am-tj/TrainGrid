import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // What's new and the home page's release note read CHANGELOG.md at runtime.
  outputFileTracingIncludes: {
    "/whats-new": ["./CHANGELOG.md"],
    "/home": ["./CHANGELOG.md"],
  },
};

export default nextConfig;
