import type { NextConfig } from "next";

const noStore = { key: "Cache-Control", value: "private, no-store" };
const noReferrer = { key: "Referrer-Policy", value: "no-referrer" };

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // Root layout lives under [locale], so unmatched URLs need app/global-not-found.tsx.
    globalNotFound: true,
  },
  // The share PNG reads its font from disk at runtime.
  outputFileTracingIncludes: {
    "/api/tracker/share/**": ["./src/lib/tracker/fonts/*.ttf"],
  },
  async headers() {
    return [
      {
        // Public share pages carry a secret token in the URL.
        source: "/:locale(en|vi)/share/:path*",
        headers: [noReferrer, { key: "X-Robots-Tag", value: "noindex, nofollow" }, noStore],
      },
      { source: "/api/tracker/:path*", headers: [noStore, noReferrer] },
    ];
  },
};

export default nextConfig;
