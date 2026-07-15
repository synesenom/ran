---
date: 2026-07-15T20:15:00Z
category: "testing"
problem: "mc.Gibbs's distributional test called gibbs.seed(7) expecting deterministic samples, but its conditionals constructed a fresh, unseeded Normal instance on every call — gibbs.seed() never touched them, so every test run drew genuinely random samples via Math.random()"
status: complete
related_issue: "#824"
related_plan: "thoughts/plans/2026-07-15-0955-hmc-sampler.md"
tags: [mcmc, gibbs, seed, reproducibility, ci-flake, prng, distribution-constructor, false-determinism]
---

# Solution: Gibbs's Conditionals Silently Defeated `gibbs.seed()`

**Date**: 2026-07-15T20:15:00Z
**Category**: testing
**Related Issue**: #824 (surfaced while babysitting the HMC sampler PR's CI)

## Problem

CI's `test (18)` job failed on a completely unrelated file (`mc.Gibbs`'s distributional test, not touched by the HMC PR's diff):

```
1) mc.Gibbs .sample() distributional test should recover both margins of a
   correlated bivariate Normal target (KS test): AssertionError
```

The test used a fixed seed (`.seed(7)`) and appeared deterministic in isolated
local runs. But repeated local runs of the *exact same command, same Node
binary, same commit* produced a **different KS statistic every time** —
proving the "seed" had no effect on the actual output at all. `test (20)` and
`test (22)` happening to pass in the same CI run were luck, not a real
Node-version distinction; the initial hypothesis (Node 18's older V8 producing
different last-bit `Math.exp`/`Math.log` results) was investigated and
disproven by installing Node 18 locally via `nvm` and confirming the failure
does not reproduce deterministically on any Node version — the KS statistic
varies from run to run regardless of Node version.

## Root Cause

The test's conditionals were:

```js
const conditionals = [
  x => new Normal(rho * x[1], sigma).sample(),
  x => new Normal(rho * x[0], sigma).sample()
]
```

Every call constructs a **brand new** `Normal` instance. `Distribution`'s
constructor (`src/dist/_distribution.js`) sets `this.r = new Xoshiro128p()` —
and `Xoshiro128p`'s own constructor (`src/core/xoshiro.js:9-14`), when given
no explicit state, seeds itself from `Math.random() * Number.MAX_SAFE_INTEGER`
— real, non-reproducible entropy. So every single conditional call draws from
a genuinely random, freshly-entropy-seeded generator, regardless of what seed
was ever passed to anything else.

`gibbs.seed(7)` only reseeds `Gibbs`'s **own** `this.r` (inherited from the
`MCMC` base class). But `Gibbs._iter()` (`src/mc/gibbs.js`) never reads
`this.r` at all — it just calls `this._conditionals[d](x1)` directly. Gibbs's
entire actual source of randomness is whatever the caller-supplied
`conditionals` closures do internally; the base class's `seed()` machinery has
no way to reach into an opaque user-supplied function and seed whatever
generators it might construct. The test called `.seed(7)` on the *sampler*,
which was structurally incapable of controlling the *conditionals'* own
randomness — a false sense of determinism that happened to go undetected until
a CI run drew an unlucky sample sequence.

This is not unique to the test: **any real caller of `ran.mc.Gibbs` who writes
conditionals the natural way** — constructing a parameterized distribution
inline and sampling it, e.g. `x => new Normal(mu(x), sigma).sample()` — hits
the identical gap. `gibbs.seed()`'s documented promise ("for deterministic,
reproducible sampling", inherited from `MCMC.seed()`'s JSDoc) is silently
false for this entire, natural style of conditional. This is a real, un-tracked
design gap in `Gibbs`'s public contract, not merely a test artifact.

## Fix

Reused a single, **explicitly seeded** standard-Normal generator across every
conditional call, instead of constructing a new unseeded one per call —
mirroring the pattern `RWM`/`HMC` already use for their own internal
proposal/momentum samplers (`this._q = new Normal(0, 1)`, constructed once,
reseeded explicitly, sampled repeatedly):

```js
const z = new Normal(0, 1).seed(seed)
const seededConditionals = [
  x => rho * x[1] + sigma * z.sample(),
  x => rho * x[0] + sigma * z.sample()
]
const gibbs = new Gibbs(seededConditionals, { dim: 2 }, { x: [0, 0] })
```

Verified deterministic by running the exact test logic standalone (outside
mocha, via a throwaway Node script) three times in a row — identical KS
statistics every run, unlike the original which varied every run. Also
widened from a single seed to three fixed seeds (`[0, 7, 42]`, matching the
`mc.RWM`/`mc.ARS` convention already used elsewhere in this file) as
additional defense against the KS test's own inherent ~1% false-positive rate
now that the underlying determinism is actually real.

## Prevention Strategy

**Any test (or real caller) of `Gibbs` whose conditionals construct a
`Distribution` instance and sample from it must explicitly seed that instance
(or a shared generator it draws from) — `gibbs.seed()` alone does nothing for
conditional-internal randomness.** When writing or reviewing a `Gibbs`
conditional that needs reproducibility: check whether it constructs a fresh,
unseeded `Distribution` per call (a red flag — `new SomeDist(...).sample()`
inline, with no `.seed()` in sight) versus reusing one seeded generator across
calls (the pattern that actually works).

More generally: **a "seeded, deterministic" claim on a test is only as strong
as the actual data path it exercises.** Before trusting that a fixed seed
makes a test reproducible, verify empirically by running the *exact* test
logic multiple times and confirming bit-identical output — a test that merely
*calls* `.seed(...)` somewhere is not proof that the seed reaches every source
of randomness the test's assertions depend on. This bug went undetected
through however many prior CI runs happened to draw a sample sequence that
stayed within the KS critical value by chance; a flaky-by-design test can pass
for a long time before an unlucky draw surfaces it.

A follow-up should evaluate whether `Gibbs`'s public contract needs a real fix
(e.g., documenting that conditionals are responsible for their own
reproducibility, or exploring whether Gibbs could thread a seeded generator
into conditionals) rather than leaving the underlying design gap that this
test-level fix works around.

## Related Solutions

- [`solutions/testing/2026-07-15-1044-ars-unseeded-ks-test-flake-fixed-seeds.md`](2026-07-15-1044-ars-unseeded-ks-test-flake-fixed-seeds.md) — a related but distinct KS-test-flakiness fix in the same PR: that one addressed the KS test's inherent ~1% false-positive rate on a *genuinely* seeded sampler by pinning multiple seeds. This solution's root cause is different and more severe: the seed was never actually reaching the randomness source at all.
- [`solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md`](../correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md) — a different flavor of the same underlying lesson: a test that only checks the visible surface (position, `.seed()` being *called*) can pass while the thing it's supposed to guarantee (reproducibility, full state) is silently broken underneath.

## Key Insight

`gibbs.seed()` can only control randomness that flows through `Gibbs`'s own PRNG — since `Gibbs`'s actual sampling happens entirely inside caller-supplied `conditionals`, any conditional that constructs a fresh `Distribution` instance per call (the natural, obvious way to write one) draws from `Math.random()`-seeded entropy regardless of what the sampler itself was seeded with; only reusing one explicitly-seeded generator across calls makes it real.
