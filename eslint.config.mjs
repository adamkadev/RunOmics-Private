import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    // Agent worktrees nest a whole checkout under here; it is not our source.
    ".claude/**",
    "coverage/**",
    // Vendored by `npm run maplibre:worker`, so it only exists after a build.
    "public/maplibre/**",
  ]),
  {
    files: ["src/components/activity/ActivityMap.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: ["src/components/activity/ShareCardThumbnails.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
