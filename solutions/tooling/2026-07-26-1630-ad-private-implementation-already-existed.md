---
date: 2026-07-26T16:30:00Z
category: "tooling"
problem: "issue #1144 read as a from-scratch algorithm implementation but the entire statistic and p-value formula already existed privately"
status: complete
related_issue: "#1144"
related_plan: "thoughts/plans/2026-07-26-1245-anderson-darling-public-test.md"
tags: [process, research, scoping, adr-0042, public-api, wrapper, cramer-von-mises, andersondarling]
---

# Solution: an issue asking to "implement" an algorithm turned out to be "promote an existing private one to a public API"

**Date**: 2026-07-26T16:30:00Z
**Category**: tooling
**Related Issue**: #1144

## Problem

Issue #1144 ("Add Anderson-Darling goodness-of-fit test") read as a full algorithm-implementation task: compute the A² statistic, implement the Marsaglia & Marsaglia (2004) asymptotic p-value approximation, handle edge cases, write tests — the kind of scope that normally means a few hundred lines of new numerical code plus a special-function/algorithm prerequisite check. Taking the issue text at face value would have led straight to re-implementing math that already existed.

## Root Cause

The library had already grown a private, internal implementation of the exact same capability — `andersonDarling(values, cdf)` in `src/dist/_tests.js`, complete with the Marsaglia polynomial tables, the finite-sample correction, and full test coverage in `test/ad.js` — but it was wired to a different feature path (`Distribution.prototype.test()`) rather than exposed as a public `ran.test.*` function. Issue text describing a user-facing gap ("there is no public `ran.test.andersonDarling`") doesn't distinguish "the math doesn't exist anywhere" from "the math exists but isn't exposed under this name/shape" — both look identical from the outside. Compounding this, an ADR written one issue earlier (`decisions/0042-single-sample-gof-test-return-shape.md`, for the sibling `cramerVonMises` export in #1134) had already explicitly named `andersonDarling`/#1144 as the next function expected to adopt its `{stat, pValue, passed}` return shape — the scoping decision had effectively already been made, it just hadn't been read yet.

## Fix

The research phase, before any implementation code was written, searched the codebase broadly (not just the obvious `src/test/` directory the issue mentioned) and found the private implementation plus the governing ADR. This reduced the plan to a ~15-line pass-through wrapper: destructure `{statistics, pValue}` from the existing private `andersonDarling`, reshape to `{stat, pValue, passed}` with a caller-supplied `alpha` (default `0.05`) replacing the private function's hardcoded `0.01`, following the exact precedent the sibling `cramerVonMises` wrapper (`src/test/cramer-von-mises.js`) had already established. No new special functions, no new algorithm, no new ADR were needed — the entire "implementation" phase was export wiring and a new test file exercising the public surface.

## Prevention Strategy

Before planning any "add X" issue that introduces a capability into a public namespace with existing siblings (a new `ran.test.*` function, a new `ran.dist.*` method that other distributions already implement privately for internal use, etc.), search the private module trees (`_*.js` files, especially ones feeding a shared dispatch point like `Distribution.prototype.test()`) for the same math under a different name or access level, and check for an existing ADR that already names the target issue. This is precisely what a thorough `/research` pass is for, and it should run before `/plan` unconditionally on "add X" issues that touch a namespace with existing siblings — skipping straight to planning/implementation from the issue text alone risks re-deriving math that's already correct and tested, at several times the diff size and review risk.

## Related Solutions

- `solutions/testing/2026-07-25-1032-cvm-scipy-public-wrapper-scope-mismatch.md` — a related but distinct lesson from the sibling `cramerVonMises` PR: once you know an implementation's exact scope, don't source `closeTo` test references from a library whose public API bundles a wider scope than what was actually built. That solution is about verifying test references *after* scope is known; this one is about *discovering* the true scope before implementation starts. Together they cover both ends of correctly scoping a "new" statistical test PR.

## Key Insight

When an issue asks to "add" a statistical capability to a public namespace, check whether the same math already exists privately (feeding some other internal call site, like a shared `.test()` dispatcher) and whether a prior ADR has already dictated the shape it should take — the real work may be a shape-preserving public wrapper around existing, correct, already-tested code, not new math, and skipping this check risks re-implementing (and re-reviewing) work that's already done.
