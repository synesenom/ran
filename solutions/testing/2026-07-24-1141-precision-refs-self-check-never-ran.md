---
date: 2026-07-24T11:41:09Z
category: "testing"
problem: "precision-refs-continuous.py's self_check()/--check safety net had never once actually run since it was written"
status: complete
related_issue: "#1110"
related_plan: "thoughts/plans/2026-07-23-2018-precision-refs-continuous-self-check.md"
tags: [self-check, dormant-safety-net, python-node-bridge, es-module-bridge, precision-refs, dncbeta, bug-triage]
---

# Solution: precision-refs-continuous.py's `self_check()` had never once actually run

**Date**: 2026-07-24
**Category**: testing
**Related Issue**: #1110

## Problem

`scripts/precision-refs-continuous.py`'s `self_check()` — the mechanism meant to cross-check this script's own mpmath-based `pdf()/cdf()` reimplementation against the scipy-vetted `refVals` hand-authored in `test/dist-cases-continuous.js` — opened `test/cases-continuous.json`, a file that has never existed anywhere in the repo. Every `--check` invocation (and every bare no-argument invocation, since the literal string `'--check'` is never actually compared against `sys.argv[1]` anywhere in the file) raised `FileNotFoundError` immediately, before checking a single value. This safety net — explicitly documented as the intended guard against exactly the class of silent-truncation bug fixed in #1108 — had never once actually run since it was written.

## Root Cause

The self-check was written against an intended JSON bridge file that nothing in the codebase ever produces — a dependency assumed to exist (or planned but never wired up) and never verified end-to-end. Because the failure mode was an immediate, unhandled `FileNotFoundError` rather than a silent no-op, it should have been maximally visible — yet it went unnoticed because nothing in CI or `npm test` invokes this Python script's `--check` path at all; it is tooling adjacent to the test suite, not part of it, so there was no automated forcing function to ever exercise the broken path.

## Fix

Replaced the static-file read with a live bridge: a new `scripts/dump-dist-cases-json.js` (`require('@babel/register')()` then `require('../test/dist-cases-continuous.js')`) evaluates every `cases[].params()` closure and prints the real, current scipy-vetted test data as JSON. `self_check()` invokes it via `subprocess.run(...)` instead of opening a static artifact, so there is nothing to go stale — this mirrors exactly how mocha itself loads the same ES-module test file, and precedent for Python-to-Node subprocess bridging already existed in `scripts/refvals-issue-135.py`.

Also added a frozen `LARGE_LAMBDA_ANCHORS` regression constant (`DoublyNoncentralBeta(2,2,1200,1200)`) duplicated from already-reviewed mpmath mp.dps=50 values already recorded in `test/precision-continuous.js:993-998` — deliberately *not* re-derived from the `dncbeta_pdf`/`dncbeta_cdf` code under test, so the check stays non-tautological — to guard the exact #1108/#1086 premature-convergence bug class going forward. An `implemented = set(PARAM_SETS.keys())` skip-filter was added so distributions this generator's dispatch doesn't implement (e.g. `TruncatedExponential`) are logged as skipped rather than producing a spurious error.

The moment the check actually ran for the first time, it surfaced **41 pre-existing latent mismatches across ~15 other distributions** (missing out-of-support clamping, `pdf(0)` boundary-limit bugs, complex-number crashes on out-of-domain input, div-by-zero at x=0) that had been silently accumulating in this script's mpmath dispatch for the entire time the check was broken. One trivial case (`NoncentralT`'s `pdf(0)` using a broken `mpmath.diff()` numerical-derivative hack instead of the already-correct `nct_pdf()` closed-form helper, which happened to sit right next to it in the same file) was fixed inline. The rest were triaged and filed as separate follow-up issues (#1115, #1116, #1117) rather than folded into this PR, per the one-concern-per-issue / PR-size-cap conventions — fixing them would have meant touching boundary-handling formulas across ~10 unrelated distributions, far beyond #1110's stated scope.

## Prevention Strategy

Any "safety net" script or check (self-tests, regression guards, `--check` flags) must be exercised at least once, ideally in CI, immediately after being written — a check that has never successfully completed a single run provides *zero* protection while looking, from reading the code, exactly like it does. When adding or restoring such a mechanism, budget explicitly for the backlog-surfacing effect: the first successful run of a long-dormant self-check should be expected to reveal an unknown quantity of unrelated latent bugs, and the fix PR should triage-and-file those rather than absorb them, keeping the PR scoped to "make the check run" rather than "fix everything it finds."

## Related Solutions

- `solutions/correctness/2026-07-23-1108-doubly-noncentral-beta-recursivesum-absolute-floor-truncation.md` — the premature-convergence bug this issue's `LARGE_LAMBDA_ANCHORS` case now guards against; documents the same `dncbeta_pdf`/`dncbeta_cdf` functions this self-check exercises.
- `solutions/correctness/2026-07-23-1707-doubly-noncentral-beta-relocated-walk-and-issue-premise.md` — prior regression-testing methodology context for the same generator script.

## Key Insight

A self-check/regression-guard that has never successfully executed (due to a broken dependency, like opening a file nothing writes) is indistinguishable from a working one by reading the code — the only way to know a safety net is real is to have watched it actually complete a run at least once, and doing so for the first time after a long dormancy should be expected to surface an unrelated backlog of latent bugs, which is a discovery event to triage, not scope-creep to fix in the same PR.
