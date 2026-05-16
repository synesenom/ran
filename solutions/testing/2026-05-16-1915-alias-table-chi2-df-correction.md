# Solution: Alias-Table chi² False Positives — Degrees-of-Freedom Correction

**Date**: 2026-05-16
**Issue**: #194
**Branch**: claude/build-issue-194-Urh0V

## Problem

After PR #192 strengthened sampling tests to run at three fixed seeds (`0`, `42`, `12345`), four discrete distributions failed their `chiTest` assertions at specific seeds:

| Distribution | Case | Seed | chi² | df | Critical |
|---|---|---|---|---|---|
| `Categorical` | moderate n (10 weights) | 42 | 17.09 | 6 | 16.812 |
| `Hypergeometric` | (30, 10, 5) | 42 | 10.24 | 2 | 9.21 |
| `Zipf` | s=3, N=100 | 42 | 22.39 | 8 | 20.09 |
| `Delaporte` | default params | 0 | — | — | — |

All failures were marginal (chi² just above the critical value) and all occurred in discrete distributions that share the same test path through `chiTest`.

## Root Cause

`test/dist.js:172` passed `Object.keys(generator.save().params).length` as the `c` argument to `chiTest`. For all `Categorical`-based distributions, `this.p = { n, weights, min }` has 3 keys, so `c = 3`.

The chi-squared goodness-of-fit degrees-of-freedom formula is:

```
df = k - 1 - m
```

where `k` is the number of bins and `m` is the number of parameters **estimated from the data**. Since ranjs tests compare samples against a *fully-specified* known distribution — the same distribution used to generate the samples — **no parameters are estimated from the data**. Therefore `m = 0`, and `df = k - 1`.

Using `c = 3` artificially reduced `df` by 3, lowering the critical value and causing marginal samples (chi² ≈ critical) to fail falsely.

**This is not a sampler bias.** An empirical sweep over 1,000 seeds showed:

| Distribution | c=3 failure rate | c=0 failure rate | Expected (p=0.01) |
|---|---|---|---|
| Categorical moderate n | 6.3% | 0.6% | ~1% |
| Hypergeometric (30,10,5) | 10.6% | 1.1% | ~1% |
| Zipf s=3 N=100 | 8.7% | 2.9% | ~1% |

At `c = 0` the rates approach the expected 1%. The Zipf elevation (2.9%) reflects the chi² approximation being rougher for heavily-skewed distributions (s=3 puts ~83% mass on k=1), not a real bias in Vose's algorithm.

## Why `_alias-table.js` Is Correct

The Vose alias sampler at `src/dist/_alias-table.js:81-88`:
```js
const i = Math.floor(r.next() * this.n)
return r.next() < this.prob[i] ? i : this.alias[i]
```

- **Index draw**: `Math.floor(r.next() * n)` is uniform over `{0, …, n-1}`. xoshiro128+ returns `(u >>> 0) / 2^32 ∈ [0, 1)`. For n=10, the maximum index-draw bias is 1 part in 4.3 × 10^8 — negligible.
- **Acceptance**: `r.next() < this.prob[i]`. Since `prob[i] ∈ [0, 1]` and the PRNG never returns exactly 1.0, boundary cases (`prob[i] = 1.0`) are handled correctly.
- **Table construction**: Leftover `large`/`small` entries after the Vose loop are set to `prob = 1.0` (lines 57-66), which is the standard defensive close for floating-point rounding residuals.

No fix to `_alias-table.js` was needed.

## Fix Applied

**`test/dist.js:171-172`** — changed the third argument to `chiTest` from the parameter count to `0`:

```diff
- : chiTest(generator.sample(SAMPLE_SIZE), x => generator.pdf(x),
-   Object.keys(generator.save().params).length), `seed ${s}`)
+ : chiTest(generator.sample(SAMPLE_SIZE), x => generator.pdf(x), 0), `seed ${s}`)
```

This makes `df = k - 0 - 1 = k - 1`, the statistically correct value for goodness-of-fit testing against a fully-specified distribution.

## Effect on Other Distributions

The change is strictly more lenient (larger `df` → larger critical value). All previously passing tests continue to pass. The fix transitively resolved the `Delaporte` false positive as well (also a discrete distribution using `chiTest`).

## Prevention

When `chiTest` is called in a goodness-of-fit context with a known (not estimated) distribution, always pass `c = 0`. The `c` parameter should only be non-zero when distribution parameters were fitted to the *same* sample being tested (i.e., in goodness-of-fit-after-MLE contexts, which ranjs tests never use).
