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
    "coverage/**",
  ]),
  {
    files: [
      "src/components/activities/ActivityListClient.tsx",
      "src/components/analytics/AnalyticsClient.tsx",
      "src/components/dashboard/FirstLaunchHint.tsx",
      "src/components/layout/ThemeToggle.tsx",
      "src/components/settings/AccentPicker.tsx",
      "src/components/settings/ThemeSegmented.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    files: [
      "src/components/analytics/AnalyticsClient.tsx",
      "src/components/dashboard/CelebrationOverlay.tsx",
      "src/components/map/useMapRoutes.ts",
      "src/lib/useShareCardMap.ts",
    ],
    rules: { "react-hooks/exhaustive-deps": "off" },
  },
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
