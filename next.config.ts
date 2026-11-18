import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // What's new, the home page's release note and the profile read CHANGELOG.md at runtime.
  outputFileTracingIncludes: {
    "/whats-new": ["./CHANGELOG.md"],
    "/home": ["./CHANGELOG.md"],
    "/profile": ["./CHANGELOG.md"],
  },
};

export default nextConfig;
