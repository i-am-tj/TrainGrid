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
  // Social pages are members-only and personal: never indexed, archived or
  // shown as snippets, whatever a crawler is told by the page itself.
  async headers() {
    const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" }];
    return ["/feed/:path*", "/people/:path*", "/posts/:path*", "/profile/:path*"].map((source) => ({
      source,
      headers: noIndex,
    }));
  },
};

export default nextConfig;
