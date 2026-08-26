---
date: 2026-08-26T09:00:00Z
category: "tooling"
problem: "R's cat() truncates numeric output to 7 significant digits, producing false mismatches when treated as a 1e-14-precision reference source"
status: complete
related_issue: "#1270"
related_plan: "thoughts/plans/2026-08-26-0630-issue-1270-test-precision-gate.md"
tags: [tooling, external-reference, r, subprocess, precision-gate, floating-point, false-positive]
---

# Solution: R's cat() silently truncates precision-gate references to 7 significant figures

**Date**: 2026-08-26T09:00:00Z
**Category**: tooling
**Related Issue**: #1270

## Problem

The first `--check` run of the new `scripts/precision-refs-test.py` generator (issue #1270's `src/test/` hypothesis-test precision gate, the first `scripts/precision-refs-*.py` to source references from R rather than mpmath) reported 25 of 27 cases as numeric mismatches against ranjs's own output — reading as widespread bugs across nearly every hypothesis test in `src/test/`, when ranjs was in fact correct all along.

## Root Cause

Every reference value was extracted from R via a plain `cat(x$statistic, x$p.value)` call at the end of each `Rscript -e '<code>'` subprocess invocation. R's `cat()` renders numbers through `options("digits")`, which defaults to **7 significant figures** — a print-formatting default meant for interactive/human-readable output, not a serialization format. Every value crossing the R→Python subprocess boundary was silently truncated to ~1e-7 relative precision before Python ever saw it, far looser than this repo's established 1e-14 precision-gate standard. The "mismatches" were entirely formatting artifacts of the bridge, not numeric disagreements between R and ranjs.

## Fix

Every R call site was routed through a `_fp()` helper (`scripts/precision-refs-test.py`) that wraps each expression in `sprintf("%.17g", ...)` before `cat()`, guaranteeing a full float64 round-trip (17 significant digits is always sufficient per Steele & White) so R's print-formatting default never touches the value actually read by Python.

## Prevention Strategy

Any future `scripts/precision-refs-*.py` generator that shells out to an external stats tool (R, or any CLI whose default numeric output is print-oriented rather than serialization-oriented) must force full-precision output **at the source**, before the value crosses the process boundary — never trust a language's interactive/print default when treating its stdout as a numeric data channel. For R specifically: always `sprintf("%.17g", ...)` (or `options(digits = 17)`) rather than a bare `cat()`/`print()` of a numeric value. More generally, before trusting any external-tool bridge's numeric output as a precision-gate reference, verify empirically (a quick round-trip of a known non-terminating value like `1/3`) that the full float64 precision actually survives the bridge — don't assume it does just because the tool is "canonical."

## Related Solutions

- None found for R/external-CLI subprocess bridges specifically — every prior `scripts/precision-refs-*.py` generator (`-continuous.py`, `-discrete.py`, `-special.py`, `-process.py`, `-summary-stats.py`) sources references from mpmath computed in-process, so this precision-loss-at-the-process-boundary failure mode had no prior occurrence to reference.

## Key Insight

R's `cat()` truncates to 7 significant digits by default — any R-subprocess precision-reference generator must force `sprintf("%.17g", ...)` on every extracted value, or it will report false mismatches against a tighter (e.g. 1e-14) precision gate that look exactly like real implementation bugs.
