import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import bundleAnalyzer from "@next/bundle-analyzer";

// Single source of truth for the app version: package.json.
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

// Every external origin the app talks to. Next.js needs 'unsafe-inline' for
// its bootstrap scripts on SSG pages (no per-request nonce), and dev mode
// additionally needs 'unsafe-eval' for react-refresh.
const csp = [
  "default-src 'self'",
  // www.gstatic.com: firebase-messaging-sw.js importScripts. apis.google.com:
  // gapi loader (api.js) that signInWithPopup needs for its postMessage
  // relay - without it the popup opens but the sign-in promise never
  // resolves (this header is also served on the SW route, so it must allow
  // both there too).
  `script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  // maptiler: map sprites/raster images; data:/blob:: MapLibre + share-card canvas.
  "img-src 'self' data: blob: https://api.maptiler.com",
  "font-src 'self' data:",
  // googleapis: Firestore/Auth/FCM; maptiler: styles/tiles/geocoding;
  // nominatim: share-card reverse geocoding; apis.google.com: gapi loader (see script-src).
  "connect-src 'self' https://api.maptiler.com https://nominatim.openstreetmap.org https://*.googleapis.com https://apis.google.com",
  // MapLibre spawns blob: workers.
  "worker-src 'self' blob:",
  // Firebase Auth sign-in iframe (authDomain) + Google account chooser +
  // gapi's own relay iframes.
  "frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // data/ is read from the filesystem at request time (ISR revalidation, the
  // API routes), but its paths are built at runtime, so nothing links it into
  // the traced module graph and the server bundle would deploy without it.
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

// `npm run analyze` opens a per-bundle treemap - watch Recharts/MapLibre creep.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

export default withBundleAnalyzer(nextConfig);
