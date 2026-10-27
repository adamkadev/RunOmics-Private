import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const SERVER_ONLY_LIB = [
  '@/lib/gemini',
  '@/lib/firebase-admin',
  '@/lib/sendPushNotification',
  '@/lib/internalAuth',
  '@/lib/internalRoute',
  '@/lib/ownerRoute',
  '@/lib/verifyFirebaseIdToken',
  '@/lib/exploreAccess',
]

const layer = (files, patterns, ignores = []) => ({
  files,
  ignores: ['**/__tests__/**', ...ignores],
  rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns }] },
})

const boundaries = [
  layer(['src/domain/**'], [
    {
      group: ['@/application/**', '@/infrastructure/**', '@/components/**', '@/app/**'],
      message: 'The domain is pure: move the type or the logic into src/domain instead of reaching up for it.',
    },
    {
      group: [
        'react', 'react-dom', 'next', 'next/**', 'lucide-react', 'recharts', 'maplibre-gl',
        'firebase', 'firebase/**', 'firebase-admin', 'firebase-admin/**', ...SERVER_ONLY_LIB, '@/lib/use*',
      ],
      message: 'The domain may not depend on a UI framework, an SDK or a server adapter.',
    },
  ]),
  layer(['src/application/**'], [
    {
      group: ['@/components/**', '@/app/**', 'react', 'react-dom', 'next', 'next/**'],
      message: 'Use cases may not depend on the UI or on Next.js; take what they need as a parameter.',
    },
  ]),
  layer(['src/infrastructure/**'], [
    {
      group: ['@/application/usecases/**'],
      message: 'An adapter implements a port or reads a domain type; it never imports a use case. Move the shared type into src/domain.',
    },
    { group: ['@/components/**', '@/app/**', 'react', 'react-dom'], message: 'Adapters may not depend on the UI.' },
  ]),
  layer(
    ['src/lib/**'],
    [
      {
        group: ['@/application/**', '@/infrastructure/**', '@/components/**', '@/app/**'],
        allowTypeImports: true,
        message: 'src/lib sits under every layer: move the module into src/application or src/infrastructure instead.',
      },
    ],
    // Keeps each route's run trace in Firestore: shrink this list, never grow it.
    ['src/lib/internalRoute.ts']
  ),
  layer(['src/components/**'], [
    { group: ['@/infrastructure/**'], allowTypeImports: true, message: 'Components get their data from the page, never from a repository.' },
    { group: SERVER_ONLY_LIB, allowTypeImports: true, message: 'A server-only module has no place in a component.' },
  ]),
  layer(
    ['src/app/**'],
    [
      {
        group: ['@/infrastructure/**'],
        allowTypeImports: true,
        message: 'Pages and routes go through a use case in src/application, not straight to a repository.',
      },
    ],
    // Composition roots, and pages that still read a repository directly: shrink this list, never grow it.
    [
      'src/app/api/internal/ai-insights/route.ts',
      'src/app/api/internal/health/route.ts',
      'src/app/api/location-override/route.ts',
      'src/app/activities/[[]id]/page.tsx',
      'src/app/profile/page.tsx',
      'src/app/shoes/[[]gearId]/page.tsx',
      'src/app/shoes/page.tsx',
    ]
  ),
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  globalIgnores([
    ".next/**",
    ".next-e2e-sparse/**",
    ".next-visual/**",
    ".next-visual-sparse/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    // Agent worktrees nest a whole checkout under here; it is not our source.
    ".claude/**",
    "design_handoff_*/**",
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
