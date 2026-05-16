---
date: 2026-05-16T12:20:00Z
category: "tooling"
problem: "Hand-rolled SVG pixel geometry in gen-badge.js breaks silently when label text changes"
status: complete
related_issue: "#117"
related_plan: "thoughts/plans/2026-05-16-1210-issue-117-badge-maker.md"
tags: [badge, svg, coverage, badge-maker, ci, circleci, dead-code, dependency-cleanup]
---

# Solution: Delegate badge SVG generation to badge-maker

**Date**: 2026-05-16T12:20:00Z
**Category**: tooling
**Related Issue**: #117

## Problem

`.github/scripts/gen-badge.js` generated the coverage badge by hand-computing SVG pixel
geometry — `labelWidth`, `valueWidth`, `totalWidth`, `labelMid`, `valueMid` — and inlining
those values into a raw SVG template literal. This pixel-math is tied to a specific
font-metric assumption: if the label text changes, the message length changes, or the
rendering environment shifts, the layout breaks silently (misaligned text, wrong total width)
because there is no schema or validator for the output.

In parallel, a dead `.circleci/config.yml` referencing `yarn coveralls` was surviving in the
repo long after the project migrated to GitHub Actions, keeping a phantom tool reference alive
where no CI system would ever catch its absence from `package.json`.

## Root Cause

The badge script was written by replicating the Shields.io SVG format by hand rather than
delegating to the library that owns that format. This coupled the script's correctness to
undocumented assumptions about character-pixel widths (`labelWidth = 65`, `valueWidth =
value.length * 8 + 9`). Any future change to the label string (e.g. from `"coverage"` to
`"cov"`) would silently produce a misaligned badge.

The dead CircleCI config survived because it was never executed — GitHub Actions took over but
the old config was never explicitly retired, leaving a reference to `coveralls` that could
mislead future contributors auditing dependencies.

## Fix

Replaced the entire pixel-math block and SVG template literal with a single call:

```js
const { makeBadge } = require('badge-maker')
const svg = makeBadge({ label: 'coverage', message: `${pct}%`, color })
```

`badge-maker@5.0.2` added as a devDependency. Coverage-read, percentage calculation, and
colour-threshold logic preserved unchanged. `.circleci/config.yml` deleted outright — no file
in the repo references it, and the active CI is entirely in `.github/workflows/ci.yml`.

## Prevention Strategy

Before writing any code that produces a format-specific artifact (SVG, JSON schema, XML),
search npm for a purpose-built library that owns that format. Hand-rolling format output is
only justified when no maintained library exists or when the format is trivially simple and
stable.

When migrating CI platforms, delete the old platform's configuration files in the same PR that
activates the new platform. Do not leave them as inert files — they mislead dependency audits
and accumulate phantom references to tools that are no longer in `package.json`.

## Related Solutions

- `solutions/tooling/2026-05-14-1400-esm-shim-node20-breakage.md` — same pattern: unmaintained
  tooling (esm shim) replaced with a maintained alternative (`@babel/register`).

## Key Insight

Hand-rolling SVG badge geometry couples correctness to undocumented font-pixel assumptions that
break silently on label text changes — delegate format-specific output to the library that owns
the format (`badge-maker`) rather than reimplementing its layout math.
