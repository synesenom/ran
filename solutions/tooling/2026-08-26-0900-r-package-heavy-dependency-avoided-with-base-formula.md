---
date: 2026-08-26T09:00:00Z
category: "tooling"
problem: "car (R package) failed to install natively due to a fragile lme4/quantreg/RcppEigen BLAS/LAPACK/Fortran dependency chain, when it was only needed as a thin wrapper over a textbook formula"
status: complete
related_issue: "#1270"
related_plan: "thoughts/plans/2026-08-26-0630-issue-1270-test-precision-gate.md"
tags: [tooling, external-reference, r, dependencies, native-build, levene-test, precision-gate]
---

# Solution: A heavy CRAN dependency was avoided by reproducing its textbook formula in base R

**Date**: 2026-08-26T09:00:00Z
**Category**: tooling
**Related Issue**: #1270

## Problem

Issue #1270's own suggested R mapping named `car::leveneTest` as the reference source for `levene`/`brownForsythe`. Installing `car` in the build sandbox failed: its transitive dependency chain (`lme4` → `quantreg`/`pbkrtest` → `RcppEigen`) needs `-lblas`/`-llapack`/`-lgfortran` link libraries that were not present, and the native compile errored with `cannot find -llapack` etc. even after installing R's own recommended packages (`MASS`, `Matrix`, `mgcv`, `nlme`, ...) via apt.

## Root Cause

Reaching for a package's convenience wrapper (`car::leveneTest`) as the default sourcing strategy created an unnecessary, fragile native-build dependency for a value that is actually a plain textbook computation: Levene's/Brown-Forsythe's test **is** a one-way ANOVA F-test on `|y - center(y)|` within each group (mean-centered for Levene, median-centered for Brown-Forsythe). `car::leveneTest` is documented, and independently confirmed by direct comparison during this build, to compute exactly this and nothing more (unlike, say, `goftest::cvm.test`, which genuinely bundles extra behavior beyond the bare asymptotic formula — see the CVM/scipy solution below). There was no feature of `car` actually needed here — only its formula.

## Fix

`car::leveneTest(center=...)`'s formula was reproduced directly in base R with no extra package: `z <- abs(y - ave(y, g, FUN=center)); anova(lm(z ~ g))`. This was verified to produce identical F-statistic and p-value to what `car::leveneTest` would have (confirmed on a small worked example before committing to the approach), and is documented inline in `scripts/precision-refs-test.py`'s `_levene_family_ref` as arguably a *better* outcome than the original plan — fewer dependencies, same canonical value, no fragile native toolchain to keep working across environments.

## Prevention Strategy

Before installing a heavy CRAN (or PyPI, or npm) package purely to compute one reference value, check whether the package is a thin wrapper over a textbook/closed-form formula. If so, prefer reproducing the formula directly in the base tool (base R, plain Python, plain Node) over installing a dependency chain — especially in sandboxed/CI/ephemeral environments where native compilation of Fortran/BLAS/LAPACK-linked packages is inherently fragile and slow (this build's initial `install.packages(c("car", "goftest"))` attempt took over 20 minutes and still failed on `car`). Always verify the hand-rolled formula against the package's documented internals, or a small manual cross-check on a toy example, before trusting it as canonical — don't assume "textbook formula" without confirming the specific package doesn't add an undocumented correction (contrast with `goftest::cvm.test`, which does, and legitimately needs its lower-level `pCvM` function called instead rather than being reimplemented from scratch).

## Related Solutions

- `solutions/testing/2026-07-25-1032-cvm-scipy-public-wrapper-scope-mismatch.md` — the contrasting case: sometimes a package's public wrapper bundles a *correction* beyond the bare formula, and the fix there is to call a *different function in the same package* (its lower-level internal), not to reimplement from scratch. The two solutions together describe a decision point: first check whether a package's value is (a) a bare formula worth reimplementing directly, or (b) formula-plus-correction worth still sourcing from the package but via its lower-level function.

## Key Insight

Before treating a specific R/Python package as mandatory for a reference value, check whether it's a thin wrapper over a textbook formula — reimplementing the formula directly in the base language avoids fragile native-toolchain dependencies without sacrificing canonicity, and is often a strictly better outcome than fighting the package's build.
