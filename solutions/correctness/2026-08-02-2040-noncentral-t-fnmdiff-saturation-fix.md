---
date: 2026-08-02T20:40:00Z
category: "correctness"
problem: "NoncentralT.pdf(x) silently returns 0 (or a badly wrong nonzero value) for low-nu, high-mu parameters where NoncentralT._fnmDiff's fnm-difference saturates without ever separating"
status: complete
related_issue: "1318"
related_plan: "thoughts/plans/2026-08-02-2040-noncentral-t-fnmdiff-saturation-fix.md"
tags: [noncentral-t, catastrophic-cancellation, tanh-sinh, quadrature, saturation-gate, direct-integration, saddle-point-domain]
---

# Solution: replacing CDF-differencing with direct density quadrature for NoncentralT's low-nu saturation blind spot

**Date**: 2026-08-02T20:40:00Z
**Category**: correctness
**Related Issue**: #1318

## Problem

`NoncentralT._pdf` computed the density via a CDF-differencing identity,
`nu * (fnm(nu+2,mu,x*scale) - fnm(nu,mu,x)) / x`. When both `fnm` calls independently saturate to
the *same* floating-point value, the difference collapses to exactly `0` — `NoncentralT(5,6).pdf(-0.5)`
returned `0` instead of the true `~3.34e-10`. A nearby regime produced a badly wrong *nonzero* value:
`NoncentralT(10,6).pdf(-1.0)` returned ~480x the true value.

This is the third occurrence of this saturation failure in this file. #1250 fixed it for
`DoublyNoncentralT._pdfPoissonMixture`'s own `fnm`-differencing pattern (adding `NoncentralT.snm`, a
direct survival-function quadrature, as a fallback gated on `nu0 >= 30 && |raw diff| < 1e-9`). #1302
confirmed the identical mechanism breaks `NoncentralT._pdf` directly and ported that same gate into a
new `NoncentralT._fnmDiff` helper — but only the *original*, pre-#1298 version of the gate, missing
the phi-equality condition #1298 had since added for `DoublyNoncentralT`. #1318's own issue text asked
to port #1298's corrected gate verbatim.

## Root Cause

Two independent findings, neither visible from reading the code alone — both required direct
numerical experimentation to surface:

**1. The issue's own literal prescription for the corrected gate was mathematically wrong.** It
specified a "sign-aware" `phi` formula (`delta = x < 0 ? -mu : mu`, mirroring `NoncentralT.fnm`'s own
internal sign-flip at line 74) as the saturation-detection reference. Tracing `fnm`'s full body shows
this is incorrect: `fnm` applies an `x >= 0 ? z : 1 - z` flip to its own internal sum before
returning (line 150). For `x < 0`, the internal `phi_internal = Φ(mu)` (since `delta = -mu` in that
branch), and the *returned* value is `1 - z = 1 - Φ(mu) - correction/2 = Φ(-mu) - correction/2` — the
same `Φ(-mu) = 0.5*(1+erf(-mu/√2))` the `x >= 0` branch saturates to directly, computed
**unconditionally**, never sign-flipped. `fnm`'s internal delta sign-flip is exactly cancelled by its
own return-value flip, so it never propagates to a caller reasoning about `fnm`'s *external* output.
Confirmed empirically: for the reported case, both raw `fnm` calls returned the bit-identical
`9.865877004244794e-10`, matching the unconditioned formula (`9.865876449133282e-10`) to 1 part in
2×10⁷ — not the sign-flipped version (`≈1`, off by nine orders of magnitude). Using the issue's
prescribed sign-flipped formula, the gate never fires for the reported case and it remains broken.

**2. Once the gate was corrected, its designated fallback (`NoncentralT.snm`) was not reliable at the
low `nu` this call site actually needed.** `snm`'s own JSDoc already disclaimed "not verified accurate
for very small nu" — but its only prior caller, `DoublyNoncentralT`, always gated it behind
`nu0 >= 30`, so that disclaimed limitation had never actually been exercised. `NoncentralT._pdf`'s own
`nu` has no such floor (as low as `1`). Measured: at `nu=5, mu=6, x=-0.5`, `snm`'s default 12σ
tanh-sinh domain returned a pdf of `3.179e-7` — **~950x off** from the `3.3377e-10` reference. Widening
the domain (30σ+) fixed this specific case, but at `nu=1` the same widening made results
**non-monotonically worse** (`30σ → 0.9999999711`, `50σ → 0.9999999589`, `100σ → 0.9999999437`,
`200σ → 0.9999999198`, moving *away* from the true value as the domain grew) — there was no
domain-width constant safe across the full range of `nu` this call site exercises.

## Fix

Abandoned CDF-differencing (and the `_fnmDiff`/`snm`-fallback pattern) for the fallback branch
entirely, rather than attempting a third iteration of gate-plus-fallback patching. Added
`static NoncentralT._pdfDirect(nu, mu, x)`, which integrates the density's own defining formula
(already documented in the class-level JSDoc) directly via `tanhSinh`:

```
f(x) = C(x) · ∫₀^∞ y^nu · exp(-0.5·(y-a)²) dy,  a = mu·x/√(x²+nu)
```

This integrand — a Gaussian bump times a power-law weight — is a single positive quantity with no
subtraction anywhere in its evaluation, so there is no cancellation to lose precision to at any `nu`.

The integration domain matters: an early prototype used a fixed additive margin (`[0, a+40]`), which
was only ~1e-7 relative error at `nu=10000` because the integrand's peak narrows as `nu` grows while a
fixed margin does not shrink with it, leaving the peak under-resolved relative to the domain width. The
shipped domain instead centers on the integrand's analytic saddle point — maximizing
`nu·ln(y) - 0.5·(y-a)²` gives `y² - a·y - nu = 0`, whose positive root is
`yStar = (a + √(a²+4·nu)) / 2` — with a width derived from the local curvature there
(`20 / √(nu/yStar² + 1)`). This reaches ~1e-13 relative error at `nu=10000`, and was cross-checked
against the closed-form central-`t` density (valid for `mu=0`) across `nu` from `1` to `10000` with no
instability like `snm`'s domain showed.

The corrected two-condition gate (`stuckAtPhi = |a-phi|<1e-12 || |b-phi|<1e-12`, OR'd with the
pre-existing `nearOppositeBoundary = nu>=30 && |a-b|<1e-9`, using the corrected unconditioned `phi`)
is inlined directly into `_pdf`; `_fnmDiff` — a single-caller private method whose CDF-differencing
abstraction no longer served a purpose once the fallback computes a density, not a CDF difference —
was removed.

**Design validated independently before implementation.** An independent design-propose/design-critique
agent pair, given the research findings, both converged with high confidence on replacing the
CDF-differencing fallback rather than hardening `snm`'s domain selection (an open numerical problem
with no known safe formula) or preserving `_fnmDiff` via an awkward conversion-factor coupling to
`_pdfDirect` (rejected as a "semantic lie" — the method would nominally return a CDF difference while
actually returning a density-derived quantity).

**A side benefit, filed separately.** Cross-checking `_pdfDirect` against the closed-form central-`t`
density incidentally surfaced a distinct, previously undetected precision bug in the *existing* fast
path: `NoncentralT(10000, 0).pdf(0.5)` returns `0.3520526413036684` via the unmodified
`nu*(a-b)/x` path, against a closed-form reference of `0.35205267469065066` (~9.5e-8 relative error) —
nine orders of magnitude worse than `_pdfDirect`'s ~7e-13 on the identical input. This case never
triggers either saturation condition (`mu=0` never approaches `phi`; the `a-b` difference isn't small
enough in absolute terms despite already having lost ~8 significant digits), so it is a genuinely
separate bug, unrelated to the mu-driven saturation mechanism this fix targets. Filed as
[#1325](https://github.com/synesenom/ran/issues/1325) rather than folded into this fix, since fixing it
requires its own investigation into whether the gate needs a relative (rather than absolute) threshold
or a `nu`-scaled one — a different question from the saturation mechanism here.

## Prevention Strategy

**When a CDF-differencing (or any subtraction-of-two-indirect-quantities) identity needs its
saturation gate patched a second time, treat that as a signal the identity itself should be replaced
with a direct, cancellation-free computation — not that the gate needs a third iteration.** Two
independent gate-patching rounds (#1250 → #1298 for `DoublyNoncentralT`, then #1302's incomplete port
→ this fix for `NoncentralT`) is exactly the pattern this repo's own #1298 solution doc's Key Insight
warned about generalizing badly: "a single numerical saturation phenomenon can produce multiple,
independently-triggerable observational signatures." Once a fallback correction has been patched more
than once, prefer eliminating the cancellation-prone computation path entirely over adding a third
detector.

**A numerical helper's own documented scope limitation is not decoration — verify it before reusing the
helper outside its previously-validated caller's parameter range.** `snm`'s JSDoc already said "not
verified accurate for very small nu," written when its only caller (`DoublyNoncentralT`) never invoked
it below `nu=30`. That caveat was accurate and ignorable *until* a new caller (`NoncentralT._pdf`,
`nu` unbounded below) actually needed the helper outside that range — at which point the previously
theoretical caveat became a ~950x real bug. Before reusing an existing numerical helper for a new call
site, check whether the new site's parameter range is a strict subset of what the helper was actually
validated against, not just what its signature accepts.

**When selecting an integration domain for a peaked integrand, derive it from the integrand's own
analytic saddle point and local curvature, not a fixed additive margin.** A fixed margin is
"generously wide" for the parameter regime it was tuned against and silently under-resolving once the
peak narrows relative to that fixed width as a parameter grows — the exact failure mode both `snm`'s
12σ-tuned-for-`nu>=30` domain and this fix's own first `[0, a+40]` prototype hit independently.

**Re-derive a saturation/trustworthiness condition from the actual observed bit values at the specific
call site being fixed — never assume a formula that looks structurally similar (here, mirroring
`fnm`'s own internal sign-flip) transfers correctly.** The issue's own prescribed `phi` formula was
plausible-looking (it directly copies a sign-flip that genuinely exists in `fnm`'s source) but wrong,
because it did not account for how that internal sign-flip interacts with `fnm`'s own return-value
transform. Confirming the *actual* saturated bit pattern against a candidate formula (as done here)
would have caught this before implementation; trusting the issue text's derivation without that check
would not have.

## Related Solutions

- `solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md` (#1250) — origin
  of `NoncentralT.snm` and the `nu >= 30` magnitude gate. **Not superseded**: its scope was always
  correctly bounded to the `DoublyNoncentralT` call sites it was validated against (which never invoke
  `snm` below `nu=30`); this fix discovered that scope does not generalize to a caller with unbounded
  low `nu`, and chose a different technique for that case rather than finding #1250's own analysis
  wrong.
- `solutions/correctness/2026-08-02-2100-noncentral-t-fnm-dual-saturation-mechanism.md` (#1298) —
  origin of the phi-equality OR-gate for `DoublyNoncentralT._fnmDiff`/`_cdfTerm`. **Not superseded**:
  its `DoublyNoncentralT`-specific fix and reasoning remain correct; this issue is about a different
  class's incomplete port of that pattern, not a flaw in #1298's own analysis.
- `thoughts/research/2026-08-02-2028-noncentral-t-fnmdiff-saturation.md` — the full empirical
  derivation behind both root-cause findings above.
- `thoughts/plans/2026-08-02-2040-noncentral-t-fnmdiff-saturation-fix.md` — the implementation plan,
  including the independent design-propose/design-critique evaluation of alternatives.

## Key Insight

A "fix the saturation gate again" patch on a subtraction-based identity is itself a signal that the
identity should be replaced with a direct, cancellation-free computation of the target quantity —
and any numerical helper pulled into a new caller's parameter range must be re-validated there, not
trusted on the strength of a different caller's prior validation, even when the helper's own docs
already (accurately, but easy to overlook) disclaimed the untested regime.
