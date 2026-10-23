---
name: code-comments
description: The comment rule for RunOmics. Use whenever you write or edit code, tests, scripts, workflows or config in this repository, before adding or changing any comment or docstring.
---

# Comments

The code says what it does. A comment says only why, when the code cannot (see 0d6a5938).

- One line, about 120 characters at most. Docstrings too.
- Keep: a constraint from outside the code (Garmin, GitHub, Vercel, a browser), a bug the code guards against, a trade-off that is not obvious.
- Never: what the next line does, the history of a change ("used to", "now", "no longer"), the reasoning behind it, or a pointer the names already give.
- No comment on code you did not change. When you edit code under a long comment, shorten it to this rule.
- Tests carry no comments: the test name says it.
- The same in workflows, scripts and config files.

Context and reasoning go in the PR description, the README or the CHANGELOG, not in the code.
