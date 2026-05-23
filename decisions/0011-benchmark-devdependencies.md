# ADR-0011: Introduce jStat and @stdlib as devDependencies for the benchmark suite

**Date**: 2026-05-23
**Status**: Accepted

## Context

Issue #114 requires a `bench/` directory with a script that compares ranjs against jStat and `@stdlib/stats/base/dists` across five distributions and four operations. Executing the comparison requires installing jStat and @stdlib packages in the development environment.

The project currently has zero production dependencies and keeps its devDependency list lean. Two installation strategies were evaluated: (a) fine-grained individual @stdlib packages (one per function, ~20 packages) and (b) per-distribution @stdlib umbrella packages plus individual random-variate generators (~10 packages total).

## Decision

Install as devDependencies only:
- `jstat` — the jStat library
- Per-distribution @stdlib umbrella packages for pdf/cdf/quantile: `@stdlib/stats-base-dists-normal`, `@stdlib/stats-base-dists-gamma`, `@stdlib/stats-base-dists-beta`, `@stdlib/stats-base-dists-exponential`, `@stdlib/stats-base-dists-poisson`
- Per-distribution @stdlib random-variate generators: `@stdlib/random-base-normal`, `@stdlib/random-base-gamma`, `@stdlib/random-base-beta`, `@stdlib/random-base-exponential`, `@stdlib/random-base-poisson`

The per-distribution umbrella approach (10 packages) was chosen over fine-grained individual packages (20 packages) because each umbrella bundles all operations for a distribution under a single `require()`, halving the devDependency count and making the benchmark script easier to extend without adding new packages.

These packages are excluded from the published npm artifact via the `files` field in `package.json` (`dist/` and `src/` only) and via `.npmignore`.

## Consequences

- devDependency count increases from ~22 to ~32 entries
- `bench/index.js` can use `const normalDist = require('@stdlib/stats-base-dists-normal')` and `normalDist.pdf(x, mu, sigma)` without per-function imports
- Adding new distributions to the benchmark requires only one stats package + one random package (2 installs), not 4
- No production code or public API is affected
