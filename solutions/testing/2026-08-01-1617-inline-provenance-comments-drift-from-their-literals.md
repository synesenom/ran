---
date: 2026-08-01T16:17:45Z
category: "testing"
problem: "A reference value's provenance comment described a computation that produces a different number than the literal it sat above, undetected for as long as the value lived inline"
status: complete
related_issue: "#1221"
related_plan: "thoughts/plans/2026-08-01-1535-process-test-reference-value-extraction.md"
tags: [testing, reference-values, provenance, mpmath, stochastic-processes, test-organization, refactor, dead-documentation]
---

# Solution: Inline provenance comments drift from their literals because nothing ever executes them

**Date**: 2026-08-01T16:17:45Z
**Category**: testing
**Related Issue**: #1221

## Problem

`test/process.js` carried 72 externally-sourced numeric reference values, each with a provenance
comment directly above its assertion, in the house style:

```js
const gbm = new GeometricBrownianMotion(0, 0.5, 1)
// scipy: stats.lognorm.pdf(0.8, s=0.5*sqrt(0.5), scale=exp(-0.0625*0.5)) = 1.2721398281078873
assert.closeTo(gbm.pdf(0.8, 0.5), 1.2721398281078873, 1e-10)
```

The comment is wrong. `scale=exp(-0.0625*0.5)` is `exp(-0.03125)`, and evaluating scipy's
`lognorm.pdf` with it gives **1.2172975135116265** — not the asserted 1.2721398281078873. The
correct log-mean is `(mu - sigma^2/2)*t = (0 - 0.125)*0.5 = -0.0625`, so the scale is `exp(-0.0625)`.
The literal was right all along; only the stated derivation was wrong.

Three further defects of the same family were in the file:

- Six values cited `// Python3 math:` as their source. That is float64 stdlib arithmetic, not one of
  the three tools `CLAUDE.md` sanctions (mpmath at `mp.dps=50`, scipy, R) — so they carried no
  independent verification at all.
- Five values (`test/process.js:537, 1056, 2148, 2677, 3396`) had **no provenance comment**.
- Two values labelled `mpmath mp.dps=50` stored literals truncated to 13-15 significant digits
  (`2.59399415029016` where the correctly-rounded float64 is `2.593994150290162`), so the comment
  claimed 50-digit provenance for a number that did not match it.

Every one of these had been green in CI since the day it was written.

## Root Cause

**A provenance comment is dead documentation: nothing executes it, nothing compares it against the
literal it describes, and the test passes identically whether it is right, wrong, or absent.**

The assertion `assert.closeTo(gbm.pdf(0.8, 0.5), 1.2721398281078873, 1e-10)` exercises exactly one
claim — that ranjs computes 1.2721398281078873. The comment asserts a *second*, entirely unchecked
claim: that scipy, given a specific parameterization, produces that same number. Only the first is
ever tested. The second can rot freely.

This is structurally the same failure as
`solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md`, where a `self_check()`
that had never actually executed was indistinguishable from a working one by reading the code. Here
the never-executed artifact is the comment rather than a function, but the mechanism is identical:
**an unexecuted claim looks exactly like a verified one.**

Two properties of the old layout made it worse:

1. **Scattered across 3399 lines.** With provenance interleaved among constructor validation, NaN
   boundary checks, symmetry identities, and CLT recovery tests, there was no vantage point from
   which all 72 values could be read together and audited. Nobody could see that six of them cited a
   tool the conventions forbid.
2. **Comments are unstructured.** `// Python3 math:` and `// scipy:` and `// exact rational:` are
   free text. Nothing could enumerate them, count them, or assert that each one names a sanctioned
   tool.

## Fix

Extracted all 71 instance-method reference values into `test/process-cases.js` as structured
records, consumed by an inline loop in `test/process.js`:

```js
{
  should: 'return log-normal density for mu=0, sigma=0.5, t=0.5, x=0.8',
  params: () => [0, 0.5, 1],
  method: 'pdf',
  args: [0.8, 0.5],
  expected: 1.2721398281078873,
  tol: 1e-10,
  source: 'scipy: stats.lognorm.pdf(0.8, s=0.5*sqrt(0.5), scale=exp((0-0.5^2/2)*0.5)=exp(-0.0625)) = 1.2721398281078873'
}
```

The decisive step was **not** the restructuring — it was writing a throwaway mpmath script that
re-derived all 72 values from each process's textbook marginal/transition law (Gaussian for
BM/OU/BB/AR1, log-normal for GBM, Poisson for the counting process, Gamma for CIR's `x0 = 0`
marginal, shifted binomial for RandomWalk) and diffed them against the asserted literals. That
confirmed all 72 literals correct to within tolerance, which is what made it safe to conclude the
GBM discrepancy was a *comment* bug rather than a value bug.

Turning provenance from a comment into a `source` **field** bought three things a comment cannot:

- It is passed as `assert.closeTo`'s message argument, so provenance appears in the failure output
  rather than only to a reader of the source.
- It is enumerable: `cases.forEach(g => g.refs.forEach(r => ...))` can assert every entry has one,
  and grep for banned tool names across a structured field rather than free text.
- Reviewing all 71 side by side is what surfaced the `Python3 math` cluster in the first place.

Deliberately **not** built: a shared runner module mirroring `test/dist-runner.js`. That runner
exists because four `dist-shard-*.js` files consume it to spread 145+ distributions across
`mocha --parallel` workers. With one consumer and 71 values, a runner is an abstraction boundary
with no reuse — every other structured case file in `test/` (`precision-continuous.js`,
`precision-discrete.js`, `precision-special.js`, `precision-summary-stats.js`) pairs a plain array
with an inline `forEach`. The rationale is recorded in the new file's header, where a maintainer
considering a runner would actually look.

## Prevention Strategy

1. **Treat a provenance comment as an unverified claim, because it is one.** When a reference value
   and its stated derivation disagree, the value is usually right (it was checked against the tool
   once, at authoring time) and the comment is usually wrong (it was typed by hand). Re-derive
   before assuming the implementation is broken.
2. **Before restructuring reference values, re-derive all of them independently.** The mpmath sweep
   cost ~150 lines of throwaway script and is what converted "the comment looks odd" into "the
   comment is provably wrong and the value is provably right." Restructuring without it would have
   faithfully carried the bad comment forward.
3. **Prefer a structured `source` field over a free-text comment** for any new batch of reference
   values. It makes provenance enumerable, greppable by tool name, and visible in failure output.
4. **When extracting values, run old and new assertions side by side first, then delete.** A
   transcription typo (wrong param, wrong arg) fails loudly during the overlap. Deleting first and
   extracting second lets a typo silently weaken a test — the same hazard as
   `solutions/testing/2026-07-21-0835-paramcountcases-shared-sample-vacuous-pass.md`.
5. **Audit provenance in bulk, not one assertion at a time.** All four defect families here were
   invisible when reading any single assertion and obvious when reading all 72 together. Periodically
   grep the suite for tool names outside {mpmath, scipy, R} and for literals whose digit count
   undershoots float64 while claiming `mp.dps=50` (tracked as #1288).
6. **Prove a test-only refactor is coverage-neutral by diffing the nyc table**, not by trusting that
   relocation is safe. `nyc` measures `src/**` only, so an identical `src/process` table before and
   after is direct evidence no branch lost its only exerciser.

## Related Solutions

- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` — a safety net that
  never executed was indistinguishable from a working one; same "unexecuted claim looks verified"
  mechanism, applied to a function rather than a comment.
- `solutions/testing/2026-05-23-1010-circular-quantile-refvals-provenance-audit.md` — 20
  `quantileVals` sourced from the ranjs bundle itself; established the rule that every reference must
  name a source outside the codebase, which is what flagged the `Python3 math` citations here.
- `solutions/testing/2026-05-22-1708-refvals-self-validation-cancellation-boundary.md` — near a
  cancellation boundary a reference must not use the same reformulation it guards; why AR1's three
  near-unit-root guards were re-derived from the *untransformed* expression at 50 digits and kept
  their `1e-15`/`1e-12` tolerances.
- `solutions/testing/2026-07-29-2007-normal-far-tail-refvals-absolute-tolerance-blind-spot.md` — a
  value duplicated across files went stale in one copy; motivated removing the duplicate here rather
  than leaving the literal in two places.

## Key Insight

A provenance comment is never executed, so a wrong one is indistinguishable from a right one until
someone re-derives the value by hand — which is why provenance belongs in a structured field that
can be enumerated and checked in bulk, and why any reference-value refactor must independently
re-derive every value *before* moving it, not after.
