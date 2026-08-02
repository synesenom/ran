---
date: 2026-08-02T12:14:00Z
category: "tooling"
problem: "existing_groups() dropped leading indentation on preserved groups, masked for the script's entire history by npm run standard --fix always running right after --render"
status: complete
related_issue: "#1287"
related_plan: "thoughts/plans/2026-08-02-1022-precision-refs-continuous-regeneration-safety.md"
tags: [precision-refs, auto-fixer-masking, byte-identical-regeneration, idempotency, indentation, latent-bug]
---

# Solution: Preserved-group indentation loss masked by standard --fix

**Date**: 2026-08-02T12:14:00Z
**Category**: tooling
**Related Issue**: #1287

## Problem

While fixing the three defects issue #1287 named (comment-unaware brace scanner, stale `TEMPLATE`,
missing tolerance/comment backfill), the fix's own idempotency check — re-seeding
`scripts/precision-refs-continuous.py`'s reference cache from a just-rendered file and rendering
again — surfaced a **fourth, previously undocumented defect**: a bare `--render` run silently
de-indented every *preserved* group's opening `{` by 2 spaces relative to a *freshly generated*
group. In the final state this affected 14 lines (10 pre-existing hand-maintained surplus groups
plus 4 new `PRESERVE_VERBATIM` groups added by this same fix). Nobody had ever reported or noticed
this in the script's history, despite `--render` having presumably been run and its output
committed many times before.

## Root Cause

`existing_groups()`'s span extraction built each preserved group's text as
`text = comment + src[span_start:span_end]`, where `span_start` is the index of the group's `{`
character itself — not the start of its line, so the 2-space indent sitting *before* `{` on disk
was never captured. Meanwhile, `render()`'s f-string for a *freshly generated* group bakes that
2-space indent in explicitly (`f"{comment}  {{\n..."`). So a preserved group's re-emitted text and
a freshly-generated group's text disagreed on leading whitespace — a genuine byte-identity gap.

This had been invisible for the script's entire history because the **documented workflow always
runs `npm run standard --fix` immediately after regenerating**. Standard.js's auto-fixer silently
re-indents malformed JS, so every time this bug would have produced visibly wrong output, the very
next command in the standard workflow quietly corrected it before anyone looked at the diff. The
bug only became visible in this session because Phase 4's verification deliberately diffed raw
`--render` output *without* an intervening lint-fix pass — something the normal, documented
workflow never does.

## Fix

Prepend the same `'  '` indent when building `text` in `existing_groups()`
(`text = comment + '  ' + src[span_start:span_end]`), so a preserved group's extracted text always
carries the identical leading indent a freshly-rendered group's f-string produces. Re-verified full
round-trip idempotency including an explicit "does `standard --fix` change anything?" no-op check
after the fix, confirming the gap was closed rather than merely relocated.

## Prevention Strategy

When a tool's documented workflow always chains a second normalizing or auto-fixing step
immediately after it (a formatter, a linter's `--fix`, a code generator's own post-processing
pass), that second step can permanently mask an entire class of defects in the first tool's raw
output — the first tool "looks correct" only because something downstream silently corrects it
every single time it's exercised, and no one ever sees the uncorrected version to notice.

To catch such defects:
- Periodically verify a generator's or formatter's **raw** output directly — diff it *before* any
  chained auto-fix step runs — rather than only ever inspecting the post-auto-fix result.
- This matters most for any tool whose correctness criterion is byte-identity or idempotency
  (exactly this script's `--render` contract), since an auto-fixer is specifically designed to
  erase the class of cosmetic discrepancy (indentation, whitespace, quote style) that would
  otherwise be the tell that something is subtly wrong.
- When writing a "does this regenerate cleanly" verification step for any generator, explicitly
  separate "raw generator output is correct" from "final committed output is correct after the
  full documented pipeline" — checking only the latter can hide a bug in the former indefinitely.

## Related Solutions

- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` — a different instance
  of the same broader pattern in this same script: a safety/correctness mechanism (there,
  `self_check()`; here, raw `--render` byte-identity) that looked fine by inspection but was
  actually never being exercised in the form that would reveal a problem — there because it never
  ran at all, here because its output was always silently corrected before anyone looked.
- `solutions/testing/2026-08-02-1213-naive-cache-seed-false-positive-round-trip-corruption.md` —
  found in the same verification session; that document covers the opposite failure direction
  (a verification method producing false *positives* for bugs that weren't real), while this one
  covers a verification gap that had produced a false *negative* (a real bug, undetected) for the
  script's entire prior history.

## Key Insight

A generator bug that only affects whitespace or formatting can survive undetected indefinitely if
the standard workflow always pipes its output through an auto-formatter immediately afterward —
verify raw tool output directly, without the auto-fix safety net, whenever checking for
byte-identical or idempotent regeneration.
