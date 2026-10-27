# Visual checks

A small `toHaveScreenshot` suite for the screens a perf or visual change most often breaks without failing a
test: Today, Analytics' Load and Performance tabs, the Activities week, the Plan week, a run's Charts tab and its
Same route card, and the share card at the phone's 3x. Each runs for both athletes (`rich` in English,
`sparse-fr` in French) in both themes, on a 393 × 852 phone screen.

Run it on demand, before a perf or visual pull request, not after merge. It is not part of CI or E2E.

## Run it

On a branch: **Actions → Visual → Run workflow**. A failure uploads `visual-report` with each screen's expected,
actual and diff images.

Locally (Linux only, see below):

```bash
npm run test:visual
```

## Why the screens hold still

- **One fixed day.** `e2e/visual/fixedNow.ts` sets the day. The demo generator, `next build` and `next start` run
  with `e2e/visual/fixedClock.mjs` preloaded, which moves Node's clock there, and the browser's clock is fixed to
  the same instant, so the data and the app's "today" never move.
- **Their own builds and data**: ports 3200 and 3201, `.next-visual*` and `.visual-data*`, so an e2e run beside
  them never swaps their data. The Auth and Firestore emulators run too (Java 21), since a run page reads its
  note from Firestore.
- **Nothing that moves**: reduced motion, animations and transitions off, the caret hidden, UTC, and the maps'
  WebGL canvas masked. Playwright also waits for two identical frames before it compares.
- **A tolerance**: a pixel may differ by the default colour threshold, and up to 0.2% of a screen's pixels may
  differ in all. A changed chart line or card moves far more than that.

## Update the baselines

The baselines in `e2e/visual/baselines/<project>/` are drawn on GitHub's Ubuntu runner: macOS and other Linux
images draw text differently (the app uses the device's system font, so the runner draws its own; text
wraps elsewhere), so never commit baselines made on a laptop. The checks compare layout, colour and charts, not
the phone's typeface.

1. Push the branch with the change.
2. **Actions → Visual → Run workflow**, on that branch, with **Update the baselines** ticked. It rewrites only the
   screens that changed and commits them to the branch as `test(visual): update the baselines`.
3. Look at the new images in the pull request's diff: they are the review.
4. A commit pushed by the workflow does not start CI; push the next commit, or merge `main`, to run it.

The workflow refuses to update baselines on `main`.

Moving the fixed day, a new screen or a demo-data change rewrites every baseline it touches: run the update the
same way. To add a screen, add a test to `screens.visual.ts` and run the update.
