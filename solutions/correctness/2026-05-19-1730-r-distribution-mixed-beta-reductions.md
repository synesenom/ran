---
date: 2026-05-19T17:30:00Z
category: "correctness"
problem: "R distribution mixed two incompatible Beta reductions: super(0.5, c/2) wired up the squared-variable parent, but _pdf/_cdf used the affine substitution y=(x+1)/2 then squared y — producing asymmetric output (pdf(-0.95)=0.7495 vs pdf(0.95)=0.0370 at c=4)"
status: complete
related_issue: "#261"
related_plan: "thoughts/plans/2026-05-19-1700-issue-261-r-distribution-fix.md"
tags: [r-distribution, beta-reduction, subclass-delegation, affine-vs-squared, symmetry-bug, parameterization-bug, zero-times-infinity-corner, design-critique-saved-the-day]
---

# Solution: R distribution mixed two incompatible Beta reductions

**Date**: 2026-05-19T17:30:00Z
**Category**: correctness
**Related Issue**: #261

## Problem

`ran.dist.R` produced an asymmetric distribution despite the R
distribution's PDF being symmetric on `[-1, 1]`. At `c=4`:

- `new R(4).pdf(-0.95)` returned `~0.7495`
- `new R(4).pdf(+0.95)` returned `~0.0370`
- scipy and the closed-form formula `f(x;4)=(3/4)(1-x²)` give `~0.0731`
  for both values.

The generator suffered the same defect: empirical samples clustered
toward `−1` rather than distributing symmetrically about zero. The bug
had been present since `src/dist/r.js` was first written. The test
case existed in `test/dist-cases-continuous.js` but its `refVals` were
deferred with a comment citing this exact discrepancy — meaning the
broken state was known but unblamed.

## Root Cause

The class `R extends Beta` and is supposed to express the R(c)
distribution as a transformation of a Beta. There are two valid
reductions:

- **A. Squared-variable**: if `X ~ R(c)` then `Y = X² ~ Beta(1/2, c/2)`,
  two-to-one (sign is unobserved).
- **B. Affine**: if `X ~ R(c)` then `U = (X+1)/2 ~ Beta(c/2, c/2)`,
  one-to-one. (Verified via Legendre duplication:
  `2 · 4^(c/2−1) · B(c/2, c/2) / B(1/2, c/2) = 1`.)

The buggy implementation mixed the two:

```js
constructor (c) {
  super(0.5, c / 2)              // <- parent for reduction A
  this.p = Object.assign(this.p, { c })
  // ...
}
_generator () {
  return 2 * Math.sqrt(super._generator()) - 1   // not A, not B
}
_pdf (x) {
  const y = (x + 1) / 2          // <- y is from reduction B
  return y * super._pdf(y * y)   // <- but y² is from reduction A
}
_cdf (x) {
  const y = (x + 1) / 2
  return super._cdf(y * y)
}
```

The `y²` substitution is the asymmetry source: `((-x+1)/2)² ≠
((x+1)/2)²`, so `_pdf(−x) ≠ _pdf(x)`. The generator
`2√Y − 1` is a deterministic monotone map of `Y ∈ [0, 1]`, so it
cannot produce a symmetric distribution either; small `Y` always maps
near `−1` and large `Y` always near `+1`.

This is the same family of bug as
`solutions/correctness/2026-05-18-0534-fisher-z-double-halving-subclass-delegation.md`:
a subclass passes parent arguments derived from one parameterization
and then computes the inverse transformation under a different
parameterization. Internal-consistency tests cannot catch it because
PDF, CDF, generator are all wrong in the same way.

## Fix

Switched entirely to reduction B (affine, one-to-one). The squared
alternative was rejected during design-critique because
`|x| · super._pdf(x²)` produces `0 · ∞ = NaN` at `x = 0` for `c < 2`
(including the arcsine case `c = 1`) — a silent correctness bug that
the test suite at `c = 4` would have missed entirely.

```js
constructor (c) {
  // Affine reduction: U = (X+1)/2 ~ Beta(c/2, c/2). One-to-one map onto [-1, 1] avoids the 0·∞ corner that the squared-variable reduction hits at x=0 for c<2.
  super(c / 2, c / 2)
  this.p = Object.assign(this.p, { c })
  Distribution.validate({ c }, ['c > 0'])
  this.s = [{ value: -1, closed: true }, { value: 1, closed: true }]
}
_generator () { return 2 * super._generator() - 1 }
_pdf (x)     { return 0.5 * super._pdf((x + 1) / 2) }
_cdf (x)     { return super._cdf((x + 1) / 2) }
```

Reference values for `R(4)` were derived from the exact closed form
`f(x;4) = (3/4)(1−x²)` and `F(x;4) = (3x − x³)/4 + ½`, not transcribed
from scipy, and added to `test/dist-cases-continuous.js`. The
boundary points `x = ±1` (pdf=0, cdf=0 or 1) and symmetric pairs
(`±0.25`, `±0.5`, `±0.95`) directly verify the fix.

## Prevention Strategy

When implementing "Distribution X as a transformation of Distribution
Y" (subclass extending another distribution):

1. **State the reduction in code.** Write a WHY comment directly
   above the `super(α, β)` call naming the reduction: `// Affine
   reduction: U = (X+1)/2 ~ Beta(c/2, c/2)`. The comment makes the
   coupled invariant explicit so any future edit must touch both
   sides together.

2. **Treat `(super args, inverse map)` as a single atomic unit.**
   `super(α, β)` and the transformation used in `_generator`, `_pdf`,
   `_cdf` are derived from a single reduction. Changing one without
   the other silently produces a wrong distribution.

3. **Prefer one-to-one (affine) reductions over two-to-one (squared)
   reductions** when both exist. The squared reduction has a `0·∞`
   trap at the symmetry axis (`x = 0` for symmetric distributions on
   `[-a, a]`) when the parent's first shape parameter is `< 1`. The
   affine reduction has no such corner.

4. **Independent reference values, not self-consistency.**
   The bug survived the existing GoF, monotonicity, and quantile
   tests because every internal test was self-consistent with the
   wrong distribution. Closed-form or scipy-derived `refVals` are
   the only assertion type that can catch this class of bug. When
   adding a new transformed distribution, always include `refVals`
   computed independently, not from running the new code.

5. **If you find yourself deferring `refVals` with a comment that
   says "the implementation disagrees with the documented formula",
   that is itself the bug.** Don't ship the implementation — fix it
   or file the bug.

## Related Solutions

- `solutions/correctness/2026-05-18-0534-fisher-z-double-halving-subclass-delegation.md`
  — same family: subclass passes wrong `super(...)` args, internal
  consistency tests all pass, only independent refVals catch it.
- `solutions/distribution/2026-05-15-1921-fisher-z-pdf-log-space-overflow.md`
  — another FisherZ correctness fix that flowed through subclass
  delegation.

## Key Insight

When a distribution extends another via `super(α, β)`, the parent
arguments and the inverse map used in `_pdf`/`_cdf`/`_generator` are
a coupled triple — derive all three from a single named reduction,
write that name as a WHY comment above the `super` call, and prefer
one-to-one affine reductions over two-to-one squared reductions to
avoid silent `0·∞` corners at the symmetry axis.
