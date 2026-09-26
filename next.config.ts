import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import bundleAnalyzer from "@next/bundle-analyzer";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://api.maptiler.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.maptiler.com https://nominatim.openstreetmap.org https://*.googleapis.com https://apis.google.com",
  "worker-src 'self' blob:",
  "frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    // The deployed commit, for Settings › About: a device check names the
    // build it was made on (v4.8). Vercel sets the SHA; a local build says so.
    NEXT_PUBLIC_BUILD_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "local",
  },
  outputFileTracingIncludes: {
    "/**": ["./data/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

export default withBundleAnalyzer(nextConfig);
