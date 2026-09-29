import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // Root layout lives under [locale], so unmatched URLs need app/global-not-found.tsx.
    globalNotFound: true,
  },
};

export default nextConfig;
