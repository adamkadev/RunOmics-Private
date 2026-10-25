import { describe, expect, it } from 'vitest'
import { compilePatterns, isDenied, scanText, transformLockfile, transformPackageJson } from '../export_public_demo.mjs'

describe('export_public_demo', () => {
  const config = {
    deny: [{ path: '.claude/' }, { path: 'docs/' }, { path: 'src/**/__tests__/private.test.ts' }],
    denyExceptions: [{ path: '.claude/skills/coaching-plan/rules.md' }],
  }

  it('denies directories and globs, except the paths an exception names', () => {
    expect(isDenied('.claude/skills/code-comments/SKILL.md', config)).toBe(true)
    expect(isDenied('.claude/skills/coaching-plan/rules.md', config)).toBe(false)
    expect(isDenied('src/lib/__tests__/private.test.ts', config)).toBe(true)
    expect(isDenied('docsite/index.md', config)).toBe(false)
  })

  it('keeps the public metadata and scripts, the private version, and drops a named athlete', () => {
    const privatePkg = {
      name: 'runomics',
      version: '3.2.1',
      private: true,
      scripts: { coach: 'dotenv -e .env.adam.local -- node coach', 'coach:lamiaa': 'node coach', test: 'vitest run' },
    }
    const publicPkg = {
      name: 'runomics',
      version: '3.1.0',
      description: 'Demo',
      license: 'MIT',
      scripts: { 'screenshots:portfolio': 'playwright test', test: 'old' },
    }
    const rules = {
      fromPublic: ['description', 'license'],
      publicScripts: ['screenshots:portfolio'],
      dropScripts: ['*:lamiaa'],
      scriptReplacements: [{ from: '.env.adam.local', to: '.env.local' }],
    }

    const pkg: Record<string, unknown> = transformPackageJson(privatePkg, publicPkg, rules)

    expect(Object.keys(pkg)).toEqual(['name', 'version', 'description', 'license', 'private', 'scripts'])
    expect(pkg.version).toBe('3.2.1')
    expect(pkg.scripts).toEqual({
      coach: 'dotenv -e .env.local -- node coach',
      test: 'vitest run',
      'screenshots:portfolio': 'playwright test',
    })
    expect(transformLockfile({ version: '3.1.0', packages: { '': { name: 'runomics', version: '3.1.0', dependencies: {} } } }, pkg))
      .toEqual({ name: 'runomics', version: '3.2.1', packages: { '': { name: 'runomics', version: '3.2.1', license: 'MIT', dependencies: {} } } })
  })

  it('reports a hit unless an allow entry for that file and pattern covers its line', () => {
    const patterns = compilePatterns([
      { id: 'email', regex: '[a-z]+@[a-z.]+\\.[a-z]{2,}', flags: 'g', except: '@example\\.com$' },
    ])
    const allow = [{ path: '.env.example', pattern: 'email', match: 'owner@email.com' }]
    const text = 'a=owner@email.com\nb=me@example.com\nc=real@gmail.com'

    expect(scanText('.env.example', text, patterns, allow).map((f) => f.match)).toEqual(['real@gmail.com'])
    expect(scanText('README.md', text, patterns, allow).map((f) => f.line)).toEqual([1, 3])
  })
})
