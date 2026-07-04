import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// Single source of truth for the app version: package.json.
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

// Every external origin the app talks to. Next.js needs 'unsafe-inline' for
// its bootstrap scripts on SSG pages (no per-request nonce), and dev mode
// additionally needs 'unsafe-eval' for react-refresh.
const csp = [
  "default-src 'self'",
  // www.gstatic.com: firebase-messaging-sw.js importScripts (this header is
  // also served on the SW route, so its CSP must allow it too).
  `script-src 'self' 'unsafe-inline' https://www.gstatic.com${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  // maptiler: map sprites/raster images; data:/blob:: MapLibre + share-card canvas.
  "img-src 'self' data: blob: https://api.maptiler.com",
  "font-src 'self' data:",
  // googleapis: Firestore/Auth/FCM; maptiler: styles/tiles/geocoding;
  // nominatim: share-card reverse geocoding.
  "connect-src 'self' https://api.maptiler.com https://nominatim.openstreetmap.org https://*.googleapis.com",
  // MapLibre spawns blob: workers.
  "worker-src 'self' blob:",
  // Firebase Auth sign-in iframe (authDomain) + Google account chooser.
  "frame-src https://*.firebaseapp.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
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

export default nextConfig;
