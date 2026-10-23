import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.resolve(__dirname, '../../../app/globals.css'), 'utf-8')

/**
 * A forwards fill keeps the animated transform or opacity applied, making the
 * wrapper the containing block and stacking context of the maps' fullscreen
 * overlays.
 */
describe('the page transition animations', () => {
  it.each(['fade-up', 'cal-forward', 'cal-backward'])('%s stops applying once it ends', (name) => {
    const declaration = css.match(new RegExp(`--animate-${name}:([^;]+);`))?.[1]

    expect(declaration).toBeDefined()
    expect(declaration).toMatch(/\bbackwards\b/)
    expect(declaration).not.toMatch(/\b(both|forwards)\b/)
  })
})
