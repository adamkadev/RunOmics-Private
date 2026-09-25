import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.resolve(__dirname, '../../../app/globals.css'), 'utf-8')

/**
 * PageTransition's div wraps the maps' fullscreen overlays. An animation that
 * fills forwards keeps applying after it ends, and the browser keeps treating
 * what it animates as will-change: a transform made the div the containing
 * block of the "fullscreen" map, then an opacity made it a stacking context
 * that put the map under the app's top scrim. Each was fixed once already.
 */
describe('the page transition animations', () => {
  it.each(['fade-up', 'cal-forward', 'cal-backward'])('%s stops applying once it ends', (name) => {
    const declaration = css.match(new RegExp(`--animate-${name}:([^;]+);`))?.[1]

    expect(declaration).toBeDefined()
    expect(declaration).toMatch(/\bbackwards\b/)
    expect(declaration).not.toMatch(/\b(both|forwards)\b/)
  })
})
