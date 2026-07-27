---
date: 2026-07-26T22:00:00Z
category: "tooling"
problem: "scripts/precision-refs-continuous.py's --only <name> flag looks like it scopes computation to one distribution, but with no pre-existing cache it silently recomputes all 121 continuous distributions instead"
status: complete
related_issue: "1143"
related_plan: "thoughts/plans/2026-07-26-2100-vonmises-precision-boundary-grid.md"
tags: [precision-refs, mpmath, tooling, cache, cost-avoidance, generator-script]
---

# Solution: `--only` in `precision-refs-continuous.py` scopes cache reuse, not computation

**Date**: 2026-07-26
**Category**: tooling
**Related Issue**: #1143

## Problem

Adding a single new precision-gate parameter set (`VonMises` `kappa=11`) to `test/precision-continuous.js` normally means regenerating that file from `scripts/precision-refs-continuous.py` via the documented command `python3 scripts/precision-refs-continuous.py --emit --only VonMises`. In a fresh environment — no pre-existing `/tmp/precision-continuous-cache.json`, `mpmath` not yet installed — that command does not do what its name implies: `--only` does not scope *computation* to the named distribution, it scopes *cache reuse*. With no cache present it silently falls back to recomputing all 121 continuous distributions from mpmath at `mp.dps=50`, including the `DoublyNoncentralBeta[1200,1200]` set independently documented (issues #1149/#1194) as costing ~65 minutes by itself — a wildly disproportionate cost for adding one distribution's one parameter set.

## Root Cause

`compute_cache(only=None)` (`scripts/precision-refs-continuous.py`) reuses cached groups for every distribution *not* named in `--only`, computing fresh values for everything else. That's correct when a cache from a prior full run already exists, but the script itself detects and warns about the degenerate case — `--only given but no cache at {CACHE} yet; computing everything` — meaning the cost-avoidance only works if someone already paid the full computation cost once before. A contributor who reads the flag's name (and the file's header comment) rather than its runtime warning would reasonably expect `--only VonMises` to be cheap regardless of environment state. It is not, in a cache-less sandbox, CI runner, or fresh clone — exactly the state of this session's environment.

## Fix

Rather than running the full generator pipeline, the new reference values were computed with a small, uncommitted script that imports `scripts/precision-refs-continuous.py` as a Python module (`importlib.util`, safe because the script's top-level execution is guarded by `if __name__ == '__main__':`) and calls its existing `pdf('VonMises', [11], x)` / `cdf('VonMises', [11], x)` functions directly for just the 5 chosen x-values, rounding with the same `num(...)` float64 conversion `compute_cache` uses, then hand-splicing the resulting group into `test/precision-continuous.js` to match `render()`'s exact emitted format. This reuses the identical formula code the full pipeline would use, without paying for the other 120 distributions. This is not a new pattern — it follows an existing precedent already documented in the same file: the `DoublyNoncentralBeta[1200,1200]` "large-lambda anchor" comment records that entry was generated the same way, for the same reason.

## Prevention Strategy

Before running `--emit --only <name>` (or `--only <name>` for `--render`) in `scripts/precision-refs-continuous.py`, check whether `/tmp/precision-continuous-cache.json` already exists. If it does not (fresh clone, fresh CI sandbox, or `mpmath` freshly installed with no prior run), do not run the flag expecting it to be cheap — either accept the full-suite recomputation cost deliberately, or use the "import as module, call `pdf()`/`cdf()` directly for just the new group" pattern this session and the `DoublyNoncentralBeta` precedent both used. This is worth surfacing explicitly rather than relying on every future contributor rediscovering the runtime warning message on their own.

## Related Solutions

- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` — a different tooling gotcha in the same generator script (a dormant self-check that silently never ran); both cases show this script's safety/cost-control mechanisms can look complete while having a gap nobody had walked into yet.
- `solutions/correctness/2026-07-26-1339-vonmises-cdf-oscillating-term-premature-convergence.md` — the bug that caused the VonMises boundary set to be withheld in the first place; this solution documents the tooling side of finally adding that withheld set back.

## Key Insight

In `scripts/precision-refs-continuous.py`, `--only <name>` scopes *cache reuse*, not *computation* — with no pre-existing cache it silently recomputes all 121 distributions (including a ~65-minute `DoublyNoncentralBeta[1200,1200]` set) instead of just the named one, so in a cache-less environment the safe way to add or update a single distribution's reference values is to import the script as a module and call its `pdf()`/`cdf()` functions directly for just the new group, as already precedented by the `DoublyNoncentralBeta[1200,1200]` comment in the same file.
