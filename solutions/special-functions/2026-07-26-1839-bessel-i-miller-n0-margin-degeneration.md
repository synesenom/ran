---
date: 2026-07-26T18:39:45Z
category: "special-functions"
problem: "besselI(0, x) returned ~1e-9 relative error (vs. mpmath) for x in roughly (10, 14], three to four orders of magnitude worse than the library's usual ~1e-14 precision"
status: complete
related_issue: "#1185"
related_plan: "thoughts/plans/2026-07-26-1548-besseli-n0-margin-fix.md"
tags: [special-functions, bessel, miller-backward-recurrence, margin-formula, degenerate-boundary, precision-gate, self-referential-test-literal]
---

# Solution: besselI(0,x) Miller backward-recurrence n=0 margin degeneration

**Date**: 2026-07-26
**Category**: special-functions
**Related Issue**: #1185

## Problem

`besselI(0, x)` returned results with ~1e-9 to ~1e-10 relative error (versus mpmath at
`mp.dps=50`) for `x` in roughly `(10, 14]` — three to four orders of magnitude worse than
the library's usual ~1e-14 to 1e-15 precision, despite the input being entirely valid and
in-range (no `NaN`, no overflow, no error signal of any kind). This silently degraded
every caller whose effective Bessel argument could land in that band: `Rice`, `VonMises`,
`Skellam` (at `k=0`), and `NoncentralChi`/`NoncentralChi2` (when the effective order is
0). Issue #1143's boundary-grid work had already found this exact gap and deliberately
withheld four precision-gate parameter sets (`Rice[3.16,1]`, `NoncentralChi[2,3.5]`,
`NoncentralChi2[2,8]`, `Skellam[6,5]`) rather than mask it with a loosened tolerance.

## Root Cause

`_besselIBackward` (`src/special/bessel.js`) computes `I_n(x)` via Miller's backward
recurrence, whose truncation index (run-up length) is
`j_max = 2 * (n + Math.round(Math.sqrt(40 * n))) + Math.ceil(2 * x)`. The
`sqrt(40 * n)` term is meant to give the recurrence enough "cold start" headroom for the
arbitrary initial condition to decay before reaching the target order `n`. For `n = 0` —
the order `besselI(0, x)` dispatches to for `|x| > 10` — this term evaluates to exactly
`0`, so `j_max` collapses to the bare `Math.ceil(2 * x)` x-scaling term with zero extra
margin. Every `n >= 1` order (even `n = 1`) already gets a nonzero margin from the same
formula and is unaffected. The bug is a boundary/degenerate-case gap in an
empirically-tuned formula, not a logic error — the formula was calibrated against
reference values for `n >= 1` and never re-validated at `n = 0` specifically. This is the
second precision-margin bug found in this exact function; issue #544 previously fixed an
unrelated large-x normalization/overflow bug in the same loop (see
`solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md`).

## Fix

Changed `Math.sqrt(40 * n)` to `Math.sqrt(40 * Math.max(n, 1))` — a one-line,
provably-no-op-for-`n>=1` change that makes `n=0` borrow `n=1`'s already-validated margin.
This was chosen over two alternatives specifically to minimize blast radius:
`Math.sqrt(40 * (n + 1))` was rejected because it's a uniform shift that unnecessarily
increases `j_max` (and iteration count) for every `n >= 1` order that was already
correctly calibrated; an unconditional `Math.max(margin, 12)` floor was rejected because
it introduces an undocumented magic constant with a hidden coupling to the `40`
coefficient. `Math.max(n, 1)` is the smallest diff and self-documents intent.

Alongside the fix: (1) corrected a pre-existing test literal in `test/special.js` that
had been self-referentially derived from the buggy implementation's own output rather
than mpmath (violating the codebase's testing convention, and undetected until this fix
changed the computed value and broke the assertion); (2) added the four precision-gate
parameter sets that issue #1143 had deliberately withheld because they surfaced this
exact bug; (3) a `/review`-driven follow-up tightened a newly added test's tolerance from
1e-13 to 1e-14 to match measured precision and the downstream precision-gate tolerances.

Regenerating the full precision-gate reference suite also surfaced an unrelated,
pre-existing hang in `scripts/precision-refs-continuous.py`'s self-check pass on
`DoublyNoncentralBeta` (100+ minutes CPU with no progress) — worked around by computing
just the needed groups directly via the generator's own `pdf`/`cdf`/`xvalues` functions
rather than running the full self-check/emit pipeline, and filed separately as #1194
rather than fixed here (out of scope for this issue, and untouched by this change).

## Prevention Strategy

When an empirically-tuned numerical margin/threshold formula contains a term that scales
with a parameter (here, `sqrt(40 * n)` scaling with Bessel order `n`), explicitly check
and test the formula's behavior at the parameter's degenerate boundary value (`n = 0`,
`n = 1`, etc.) — degenerate inputs that zero out a scaling term are exactly where
"correct for the general case" silently becomes "wrong at the edge," with no exception or
`NaN` to flag it.

Never let a test's reference literal be computed from the implementation under test (the
codebase's explicit rule, `CLAUDE.md` Testing Conventions) — this class of bug hides
behind a self-referential test until a fix changes the value and the test breaks for the
"wrong" (i.e., correct) reason, rather than ever having caught the original bug.

When a precision-gate boundary-grid effort withholds specific parameter sets because they
surface a known bug (as #1143 did here), leave a comment documenting exactly which sets
and why — this made the eventual fix's acceptance criteria (issue #1185) mechanical
rather than requiring re-discovery.

## Related Solutions

- [`solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md`](./2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md) — the prior fix to this same `_besselIBackward` function (issue #544): a large-x normalization/overflow bug, unrelated in mechanism but the same lesson about empirically-tuned recurrence parameters needing re-validation whenever a new input regime is exercised.

## Key Insight

In empirically-tuned Miller backward-recurrence margin formulas of the form
`f(n) = C + g(n)`, always check whether `g(n)` degenerates to zero at the smallest valid
`n` (especially `n=0`) before trusting that the formula's "general case" calibration
covers the boundary case — the fix here (`Math.max(n, 1)`) is the general pattern of
"borrow the nearest known-good calibrated value" rather than re-deriving margin
analytically.
