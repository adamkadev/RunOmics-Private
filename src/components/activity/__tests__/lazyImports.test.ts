import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The activity page's first load used to carry the Firestore and auth SDKs,
 * the share-card renderer and the tab-only charts: 559 kB gzip, down to 351
 * once they load on demand. A single static import in one of these modules
 * would quietly put a whole SDK back into every activity page, and no test
 * would notice - so the imports themselves are checked.
 */
const EAGER_MODULES = [
  'src/components/activity/ActivityNotes.tsx',
  'src/components/activity/ShareButton.tsx',
  'src/components/activity/ActivityDetailClient.tsx',
  'src/lib/useOwnerAuth.ts',
]

const LAZY_ONLY = ['firebase/firestore', 'firebase/auth', '@/lib/firebase', './ShareCardModal', './ChartStack', './RunningDynamics', './ActivityNotesSheet']

// `import { x } from 'm'` and `import x from 'm'`, not `import type` and not `import('m')`.
function staticValueImports(source: string): string[] {
  return [...source.matchAll(/^import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]!)
}

describe('the activity page loads its heavy modules on demand', () => {
  for (const file of EAGER_MODULES) {
    it(`${path.basename(file)} imports none of them statically`, () => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf-8')
      expect(staticValueImports(source).filter((module) => LAZY_ONLY.includes(module))).toEqual([])
    })
  }
})
