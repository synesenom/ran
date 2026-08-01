---
date: 2026-08-01T20:37:14Z
category: "testing"
problem: "Deciding whether/where to add a precision-gate for DoublyNoncentralT(5,5,120) at negative x, when the intuitive 'closer to the mode is better-conditioned' assumption for point selection turned out to be backwards"
status: complete
related_issue: "1252 (follow-up decision from #1235; surfaced a broader/more-severe variant of the #1250 fnm floor, filed as #1298)"
related_plan: "thoughts/plans/2026-08-01-1954-issue-1252-dnct-mu5-negx-precision-gate.md"
tags: [doubly-noncentral-t, noncentral-t, fnm, precision-refs, cancellation, point-selection, hand-maintained-refs, poisson-mixture]
---

# Solution: DoublyNoncentralT[5, 5, 120] negative-x precision-gate point selection inverted the expected conditioning gradient

**Date**: 2026-08-01T20:37:14Z
**Category**: testing
**Related Issue**: #1252

## Problem

Issue #1252 asked whether `DoublyNoncentralT(5, 5, 120).pdf(x)` at negative `x` — the exact
parameter regime the original #1235 bug report was filed against — deserved precision-gate
coverage, or should be deferred entirely to #1250 (which tracks `NoncentralT.fnm`'s near-1.0
saturation floor). The existing `[5, 2, 120]` group added for #1235 deliberately avoids `mu=5` to
dodge this saturation, so `mu=5` itself — the issue's own regime — had zero automated regression
coverage. A design-propose/critique loop concluded: add a gate, but only at points where a real,
non-vacuous tolerance is achievable, decided by direct measurement rather than assumption.

The planning-time assumption was that points closer to `x=0` (nearer the bulk of the distribution
relative to its `x*mu<0` tail) would be *better*-conditioned than points deep in the tail — a
reasonable-sounding default given how most cancellation problems in this codebase behave (worse
far from the mode, e.g. `_N_F11_BOUNDARY`'s narrow x-range for the same underlying reason).
Measurement showed the opposite: `x=-0.1`, `-0.2`, `-0.25` were not merely imprecise but **wrong
by 6–18 orders of magnitude** (e.g. `x=-0.1`: ranjs returned `1.0365128119902981e-25` against an
independent mpmath reference of `5.458993467063248e-07`), while `x=-0.3`, `-0.35`, `-0.4` — further
into the tail — were well-conditioned (relative error `4.4e-9` to `8.9e-6`).

## Root Cause

`DoublyNoncentralT._pdfPoissonMixture` (`src/dist/doubly-noncentral-t.js:146-163`) computes each
Poisson-index term as `NoncentralT.fnm(nu0+2, mu, y*sHi) - NoncentralT.fnm(nu0, mu, y*sLo)`. Inside
`NoncentralT.fnm` (`src/dist/noncentral-t.js:65-150`), the value is anchored by
`phi = 0.5*(1+erf(-delta/Math.SQRT2))`, where `delta` reduces to `mu` in this call pattern — a term
that depends **only on `mu`**, not on the `nu0` argument that varies across Poisson-mixture terms.
At `mu=5`, `phi ≈ 0.99999996...`. At small `|x|` (`y` near 0), the scaled arguments `y*sHi`/`y*sLo`
passed into `fnm` are themselves small, so `fnm`'s `nu0`-dependent correction term — the part that
should distinguish consecutive Poisson-index evaluations — is far below `phi`'s ULP across the
**entire** Poisson(60)-significant `nu0` range (roughly 5 to 185 for `theta=120`), not just the
narrow tail band (`nu0~105-145`) that #1250's own issue text describes. Every per-term difference
therefore collapses to bit-for-bit `0`, and the `pdf(x)` reported by `recursiveSum` is pure
floating-point noise accumulated from far down the summation tail — order `1e-25` — rather than the
true density, order `1e-7`. Only as `x` moves further from `0` does the `nu0`-dependent correction
grow large enough relative to `phi`'s fixed ULP to survive the subtraction; this is the *opposite*
conditioning gradient from "closer to the peak/mode is better-conditioned," because the dominant
error source here is a `mu`-only plateau, not a symmetric tail-decay effect.

Separately (and unrelated to the above): `x=-0.7`, the issue's own literally-reported point, has
`cdf ≈ 2.6e-16` there, and its quantile round-trip `d.q(cdf)` returns **exactly `NaN`** — not a
loose-but-finite value any `qtol` could ever be set to pass.

## Fix

Rather than commit to a point set and tolerance a priori, the plan's Phase 1 empirically measured
mpmath (`mp.dps=50`, via the generator's existing `dnct_pdf`/`dnct_cdf` — independent of ranjs's
own `fnm`-based implementation) references against ranjs's actual `pdf`/`cdf`/quantile-round-trip
output at nine candidate `x` values (widened from an initial five once the near-zero breakage
contradicted the working assumption) before writing a single tolerance literal. This surfaced the
counter-intuitive breakage near `x=0` and located the genuinely well-conditioned window at
`x ∈ {-0.3, -0.35, -0.4}`.

A second, hand-maintained REFS group (`tol: 5e-5`, `cdfTol: 1e-3`, `qtol: 1e-4`, each with 5-9x
measured margin) was added to `test/precision-continuous.js`, sharing `name`+`params` with the
existing positive-`x` `[5, 5, 120]` group — following the `Normal`/`LogNormal` far-tail precedent
(issue #808) for expressing a second, independent point set when the generator's `DNCT_XVALS` dict
can hold only one x-list per `(nu, mu, theta)` tuple. It was placed **immediately after** the first
occurrence of that key so `render()`'s file-order occurrence-matching (`scripts/precision-refs-
continuous.py:2482-2529`) correctly preserves it verbatim on any future `--emit` regeneration
instead of misplacing or dropping it. The catastrophically broken points (`x=-0.1, -0.2, -0.25`)
and the unfixable `x=-0.7` point were both explicitly excluded, each with a comment naming the
exact mechanism and cross-referencing #1250. The broader/more-severe version of the `fnm` floor
discovered near `x=0` — a much wider blast radius than #1250's own issue text currently
describes — was filed separately as issue #1298 rather than silently expanding this test-only PR's
scope into a `src/` fix.

## Prevention Strategy

When gating a known numerical floor with a "loose but meaningful" tolerance, treat the
safe/unsafe point boundary as an **empirical measurement**, never a geometric intuition.
"Closer to the mode/peak/support-boundary is better-conditioned" is a reasonable *default* prior in
this codebase (it holds for e.g. `_N_F11_BOUNDARY`'s regime), but it is not a law — it depends
entirely on which specific cancellation mechanism dominates at that point, and here a `mu`-only
plateau term made the *opposite* gradient true. Always measure every candidate point against an
independent reference before writing a tolerance literal, and be willing to widen the candidate set
mid-investigation when initial measurements contradict the working assumption (this plan grew from
5 to 9 candidates once `x=-0.1`/`-0.2` broke the expected pattern). When a precision floor turns out
to have a wider blast radius than the issue that originally described it, file a new tracking issue
rather than quietly expanding the scope of a test-only PR that explicitly excludes `src/` changes.

## Related Solutions

- `solutions/correctness/2026-07-31-1300-doubly-noncentral-t-pdf-cancellation-x-mu-negative.md` —
  the #1235 fix this precision gate extends coverage for; its "Residual Limitation" section
  recorded the single `x=-0.7` data point (`~1.7x` pdf error) that #1252 was asked to gate or defer.
- `solutions/correctness/2026-07-30-1600-doubly-noncentral-t-pdf-f11-recurrence-instability.md` —
  the #1207 fix that first characterized this file's `j0`-peak-index regime at `theta=120`.
- `solutions/testing/2026-07-29-2007-normal-far-tail-refvals-absolute-tolerance-blind-spot.md` —
  confirms `test/precision-continuous.js`'s runner uses relative-error assertions throughout, so no
  extra precaution was needed there for this addition's small `pdf`/`cdf` magnitudes.

## Key Insight

In a Poisson-mixture-of-noncentral-t sum, a per-term cancellation floor
(`fnm(nu0+2,...) - fnm(nu0,...)` collapsing onto a `mu`-only plateau) can be *worse* near the
distribution's mode than deep in its tail — the opposite of typical floating-point-precision
intuition — so precision-gate point selection for a known numerical floor must be driven by direct
empirical measurement against an independent reference, never by assumption about which region
"should" be better-conditioned.
