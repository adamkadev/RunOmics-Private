---
name: project-rules
description: The standing rules for any change to RunOmics. Use at the start of every task in this repository - code, tests, docs, workflows or a coaching block - before editing anything, and again before pushing or opening a pull request.
---

# Project rules

Cloud sessions see only tracked files: `CLAUDE.md` is gitignored on purpose, so these rules live here.
Comments follow the `code-comments` skill; training blocks follow `coaching-plan`.

## Two athletes, two deployments

- **The owner**: English, a watch with rich data (Training Effect, LTHR, races, goals, PBs).
- **The second athlete**: French (`NEXT_PUBLIC_LOCALE=fr`), a Forerunner 55 with sparse data: no Training
  Effect, training status or LTHR, no races, goals or PBs, run/walk sessions.

Check every change against both. A feature that needs data she does not have must degrade quietly, never show
0, an empty card or an English word. The demo generator builds her profile (`npm run demo:generate -- --profile sparse`)
and the `sparse-fr` Playwright project runs it in French on an iPhone.

**No stop signals for the second athlete.** Her guidance says "no stop signals": no stop rule, symptom warning
or "stop if it hurts" in her plan, its notes, the app's copy or a notification. `draftRules.ts` refuses a draft
carrying one; never write one by hand.

## Copy

Every string lives in `src/i18n/en.ts` and `src/i18n/fr.ts`, never inline. `parity.test.ts` fails when a key is
missing from either, and its French tests refuse copy that agrees with the athlete's gender ("tu es prêt"):
write French that needs no agreement.

## Code

- The layer rule is in `eslint.config.mjs`: the domain is pure, use cases never import the UI, components never
  reach a repository, pages go through a use case. Move code to the right layer rather than add an exception.
- `docs/` explains each area: `interface.md`, `data-and-sync.md`, `coaching-and-metrics.md`, `security-and-build.md`,
  and `profiles.md` for what differs between the two deployments.

## Before pushing

| Check | When |
| --- | --- |
| `npm run verify` | Always: private-data scan, lint, types, import cycles, unit tests. |
| `ruff check scripts` and `python -m pytest scripts/tests/ -q` | Any change under `scripts/` in Python. |
| `npm run test:rules` | Any change to `firestore.rules` (Java 21). |
| `npm run export:demo -- --to <public clone> --check --strict` | Always, as CI does. A new file naming an athlete goes on the deny list in `scripts/export_public_demo.config.json`. |
| E2E: Actions → E2E → Run workflow on the branch | Before merging anything that could break the build or a page: it does not run on pull requests. |
| Visual: Actions → Visual → Run workflow | Before a perf or visual pull request (`e2e/visual/README.md`). |

The pre-push hook (`git config core.hooksPath .githooks`) runs `verify` and pytest before a push to main.

## Every pull request

- A line under `## [Unreleased]` in `CHANGELOG.md` for anything a user or a deployment notices. A manual step
  goes in that line as **Needs** (a rules deploy, a new variable, a re-sync).
- Firestore rules are deployed by hand, never by CI: `firebase deploy --only firestore:rules --project <id>` once
  per Firebase project. Say so in the CHANGELOG and the PR; until then the old rules refuse the new writes.

## Never

- Touch either athlete's data repository: no clone, read, write or push from a session. The sync owns them; the
  app reads them through `RUNOMICS_DATA_DIR` or GitHub. Use the demo data and the e2e workspaces instead.
- Commit real data: names, places, races, activity ids or health numbers. `verify:private-data` and the export
  catch some of it, not all.
- Call an AI API for a coaching block. The coach runs through Claude Code by hand: `npm run coach -- <command>`
  writes the prompt, the session answers it under the `coaching-plan` skill, and `--from-answer` feeds the
  answer back through the validators. Gemini is only ever an explicit `--advisor gemini`.
