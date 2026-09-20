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
    // maplibre's worker bundle, copied out of node_modules by
    // `npm run maplibre:worker` and gitignored. It only exists after a build,
    // so linting it made `npm run lint` say different things before and after
    // one - three warnings about minified third-party code nobody here wrote.
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
