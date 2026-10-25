import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A single static import in one of these modules would quietly put the Firestore or auth SDK, the share-card
 * renderer or a tab-only chart back into every activity page's first load, so the imports themselves are checked.
 */
const EAGER_MODULES = [
  'src/components/activity/ActivityNotes.tsx',
  'src/components/activity/ShareButton.tsx',
  'src/components/activity/ActivityDetailClient.tsx',
  'src/lib/useOwnerAuth.ts',
  'src/components/settings/SettingsClient.tsx',
]

const LAZY_ONLY = ['firebase/firestore', 'firebase/auth', '@/lib/firebase', '@/lib/firebaseAuth', './ShareCardModal', './ChartStack', './RunningDynamics', './ActivityNotesSheet']

// `import { x } from 'm'` and `import x from 'm'`, not `import type` and not `import('m')`.
function staticValueImports(source: string): string[] {
  return [...source.matchAll(/^import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]!)
}

describe('the activity and Settings pages load their heavy modules on demand', () => {
  for (const file of EAGER_MODULES) {
    it(`${path.basename(file)} imports none of them statically`, () => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf-8')
      expect(staticValueImports(source).filter((module) => LAZY_ONLY.includes(module))).toEqual([])
    })
  }
})
