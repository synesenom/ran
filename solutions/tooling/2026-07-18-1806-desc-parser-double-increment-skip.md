---
date: 2026-07-18T18:05:59Z
category: "tooling"
problem: "assembleLinks() in the docs build silently dropped every second {@link} in a JSDoc paragraph"
status: complete
related_issue: "#997"
related_plan: "thoughts/plans/2026-07-18-1727-desc-parser-double-increment-skip.md"
tags: [docs-build, off-by-one, for-loop-increment, jsdoc-link, desc-parser, hardening-audit]
---

# Solution: Fix double-increment skip in desc-parser assembleLinks() loop

**Date**: 2026-07-18T18:05:59Z
**Category**: tooling
**Related Issue**: #997

## Problem

`docs/src/desc-parser.js`'s `assembleLinks()` walks a JSDoc description paragraph's AST `children` array (interleaved `text`/`link` nodes) pairwise, merging each `(text, link)` pair into a single `<a>` tag. Any paragraph containing a **second** `{@link ...}` construct had that second link silently rendered as raw literal AST text in the generated docs instead of a hyperlink — it was never even inspected by the merge logic.

This also interacted badly with a prior hardening commit (#980), which added a guard that `throw`s `Bare {@link} not supported` when a link has no preceding `[text]` bracket (previously this null-dereferenced deep in the AST walk instead of failing loudly). Because the buggy loop never reached the second link in a paragraph, a bare (unbracketed) `{@link ran.mc.RWM}` in `src/mc/adaptive-metropolis.js` sat undetected — the #980 guard could never fire on it. Fixing the loop meant that link would suddenly be inspected for the first time and crash `npm run docs`, unless fixed in the same change.

## Root Cause

```js
const assembleLinks = (children, location) => {
  for (let i = 0; i < children.length; i++) {
    if (children[i + 1] && children[i + 1].type === 'link') {
      // ... merge children[i] and children[i + 1] into children[i] ...
      delete children[i + 1]
      i += 2   // BUG
    }
  }
  return children
}
```

After consuming a pair at `i`/`i+1`, the next unprocessed pair starts at `i+2`. But the `for` loop's own `i++` **also** fires on this same iteration — it is not skipped by an early return or `continue`. So the manual `i += 2` plus the loop's own `+1` advanced the cursor by 3 total, landing on `i+3` instead of `i+2`. The pair at `(i+2, i+3)` was never examined: the condition tested at `i+3` checks `children[i+4]`, so `children[i+2]`/`children[i+3]` fell through untouched.

This is the classic "manual index-skip inside a `for` loop that already auto-increments" bug: the author correctly reasoned "I consumed 2 elements, so skip 2" but forgot the loop's own `i++` already covers one of those two steps.

## Fix

Changed `i += 2` to `i += 1` — the net advance across a consumed pair is now correctly 2 (explicit `+1` plus the loop's own `+1`), landing exactly on the start of the next unconsumed pair.

Verification, in order:
1. Added a regression test with **3 alternating** `(text, link)` pairs asserting the full resulting HTML string — 2 pairs alone would not have exposed this bug clearly (see Prevention Strategy), but a naive 2-pair test also wouldn't catch a "skip 3 instead of 2" error as cleanly as a 3-pair trace does, since the bug's effect (drop exactly the pair immediately following any given pair) only becomes visually obvious once a *third* pair is present to show whether processing "resumes" correctly afterward.
2. Ran a source-wide audit: a script that splits every `/** ... */` JSDoc block in `src/**/*.js` into blank-line-delimited paragraphs and flags any paragraph with 2+ `{@link}` occurrences. Out of 204 files containing `{@link}` at all, exactly 8 paragraphs (8 files) had 2 links in the same paragraph — none had 3+. 7 of 8 already used the safe bracketed `[text]{@link ...}` convention and needed no change (they had simply been silently under-linking their second reference, now fixed for free). Only `src/mc/adaptive-metropolis.js` had a bare second link, rewritten to `[RWM]{@link ran.mc.RWM}`.
3. Ran `npm run docs` end-to-end (exit 0) as a full-system check across all 204 files, not just the 8 audited paragraphs, confirming no other bare link was newly exposed.

## Prevention Strategy

- **Any `for (...; i++)` loop body containing a manual `i +=` assignment is a code smell.** The loop's own increment is not optional — it always fires unless the iteration hits `continue`/`break`/`return` first. When "skipping N already-processed elements," the manual increment must be `N - 1`, not `N`.
- **Don't reason about this arithmetic abstractly — trace it against a concrete multi-element example.** A 2-element trace can look deceptively correct if the bug happens to realign at the array's end; a 3+-element trace (or more) is what actually exposes a systematic off-by-one, because it shows whether the loop *resumes* correctly after the first skip, not just whether it terminates without crashing.
- **When a hardening commit adds a `throw` on a previously-tolerated malformed input, audit all reachable call sites/data for that pattern before shipping the hardening — and re-audit if a later, unrelated fix could change what's actually reached.** Here, #980 added the bare-link guard, but this loop bug meant the guard's coverage was silently incomplete: it could never fire on second-and-later links in a paragraph. A later, purely mechanical fix (the loop increment) then exposed exactly the gap the hardening was supposed to close. A cheap, repeatable script-based audit (grep/paragraph-split across the whole tree) caught it systematically rather than by inspection.

## Related Solutions

No directly related past solution found — this is the first `tooling` entry specific to `docs/src/desc-parser.js`. See `solutions/tooling/2026-05-18-1000-eslint-plugin-jsdoc-esm7-schema-incompatibility.md` and other `tooling` entries for related docs/JSDoc-pipeline maintenance patterns (different root causes, same subsystem).

## Key Insight

When a `for` loop already auto-increments `i`, a manual `i += N` inside the body meant to "skip N consumed elements" must be `i += (N - 1)` — and when hardening a function to throw on previously-tolerated malformed input, an unrelated later fix that changes control flow can newly expose that input to the guard, so audit everything the guard could now reach, not just the code path being fixed.
