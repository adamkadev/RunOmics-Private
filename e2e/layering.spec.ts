import { test, expect } from './fixtures'

// The app's background (.aurora) is a fixed, opaque layer. Text it paints over
// is gone for the reader and still passes toBeVisible(), so this asks the
// browser what is on top: at the centre of every piece of text in the page it
// must be the page, never the background. It runs after the page transition,
// because the stacking context that animation adds while it plays once hid
// the whole problem - pages drew, then vanished as it ended.
for (const route of ['/', '/activities', '/plan', '/analytics', '/profile']) {
  test(`${route} is drawn above the app's background`, async ({ page }) => {
    await page.goto(route)
    await page.waitForFunction(() => {
      const wrapper = document.querySelector('main .animate-fade-up')
      return wrapper !== null && wrapper.getAnimations().length === 0
    })

    const covered = await page.evaluate(() => {
      const background = document.querySelector<HTMLElement>('.aurora')
      if (!background) return ['no .aurora element']
      // It ignores the pointer, so hit-testing would look straight through it.
      background.style.pointerEvents = 'auto'
      const hidden: string[] = []
      for (const el of document.querySelectorAll('main *')) {
        const hasText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        if (!hasText) continue
        const box = el.getBoundingClientRect()
        const y = box.top + box.height / 2
        if (box.width === 0 || y < 0 || y > innerHeight) continue
        const hit = document.elementFromPoint(box.left + box.width / 2, y)
        if (hit && background.contains(hit)) hidden.push(el.textContent!.trim().slice(0, 40))
      }
      background.style.pointerEvents = ''
      return hidden
    })

    expect(covered).toEqual([])
  })
}
