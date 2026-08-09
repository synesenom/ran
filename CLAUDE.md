# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`ranjs` is a JavaScript statistical library for generating random variates, working with probability distributions, testing hypotheses, and computing statistical properties. Built as ES modules, distributed as ESM (`dist/ranjs.esm.js`), CJS (`dist/ranjs.cjs.js`), and minified UMD (`dist/ranjs.min.js`) via Rollup.

## Commands

```bash
# Install dependencies
npm install

# Run linter (Standard.js)
npm run standard

# Run JSDoc linter (eslint-plugin-jsdoc)
npm run jsdoclint

# Run tests (Mocha + coverage thresholds)
npm test
# IMPORTANT: never pipe `npm test` directly through grep, head, or tail — the
# mocha output prints "N passing" even when nyc's coverage thresholds are
# breached; the failure is only visible in the exit code and the
# "ERROR: Coverage for X does not meet global threshold" lines that a live
# filter pipe will swallow. Thresholds: branches 90%, lines 98%, functions
# 100%, statements 98%.
#
# IMPORTANT: always redirect the full, unfiltered output to a log file in the
# SAME command that runs the suite, then read that file as many times and in
# as many ways as needed. Never re-run the suite just to see a different slice
# of output you didn't capture the first time — the suite is slow and a
# second run wastes time for output you could have gotten from the first:
npm test > /tmp/ranjs-test.log 2>&1; echo "exit: $?"; tail -n 80 /tmp/ranjs-test.log
# The tail surfaces the coverage summary and any threshold errors — the part
# most often needed first. Do NOT read the whole log file into context — a
# full run can be thousands of lines and dumping all of it wastes tokens just
# like a re-run wastes time. Query the saved log selectively instead:
#   - `grep -c "passing\|failing"` or `grep -n "AssertionError"` for counts
#   - `grep -n -B2 -A20 "<test name>"` to pull one failure's stack trace
#   - Read with offset/limit around a line number grep already found
# Only re-invoke `npm test` if the source changed since the log was captured
# — never just to get a different slice of output you didn't pull the first
# time. The exit code alone tells you pass/fail; a non-zero exit with
# "N passing" in the tail means a coverage threshold was breached, not a test
# failure — grep the log for "ERROR: Coverage" to see which one.

# Build minified bundle
npm run build

# Generate docs
npm run docs

# Validate TypeScript declarations
npm run typecheck
```

## Architecture

**Entry point:** `src/index.js` — re-exports all modules as named namespaces (`core`, `dependence`, `dispersion`, `dist`, `location`, `shape`, `test`).

**Core abstractions:**
- `src/dist/_distribution.js` — Abstract `Distribution` base class. New distributions subclass this and call `super(type, k)` where `type` is `'continuous'` or `'discrete'` and `k` is the parameter count. The constructor sets `this.p` (parameters), `this.s` (support bounds as `[{closed, value}, ...]`), `this.c` (pre-computed speed-up constants — **must be a named object `{ name: value, ... }`, never a positional array**; leaf classes that extend `Distribution` directly use `this.c = { ... }`; subclasses that extend a parent which already sets `this.c` keys must use `Object.assign(this.c, { ... })` to avoid silently destroying the parent's constants), and `this.r` (PRNG). Distributions must implement `_pdf(x)` (or `_pmf(x)` for discrete) and `_cdf(x)`. The base class derives `sample()`, `pdf()`, `cdf()`, `quantile()`, `hazard()`, `cHazard()`, `survival()`, `likelihood()`, `aic()`, `bic()`, and `test()` from those two methods. Parameters are validated via `static validate(params, constraints)` in the constructor.
- `src/algorithms/` — Numerical algorithms: Chandrupatla hybrid bisection/IQI root-finding (`chandrupatla.js`), Newton's method (`newton.js`), bracket search (`bracket.js`), rejection sampling (`rejection.js`), Neumaier compensated summation (`neumaier.js`), accelerated summation (`accelerated-sum.js`), recursive summation (`recursive-sum.js`), quickselect (`quickselect.js`).
- `src/special/` — Special mathematical functions: gamma, log-gamma, incomplete gamma/beta, beta, log-beta, Bessel functions, error function, digamma, hypergeometric, Hurwitz zeta, Riemann zeta, Lambert W, Marcum Q, Owen T, Stirling numbers.
- `src/core/` — PRNG (`xoshiro.js` — xoshiro128+), mathematical constants, seeding utilities. Exports `float` (uniform `[0,1)`), `int`, and `bool` generators.
- `src/la/` — Linear algebra: `matrix.js` and `vector.js`.
- `src/mc/` — Markov Chain Monte Carlo: `_mcmc.js` (abstract base — accumulators, `warmUp`/`sample`, `ar`/`ac`/`ess`/`statistics`), and the sampler suite: `rwm.js` (random-walk / diagonal adaptive Metropolis), `adaptive-metropolis.js` (full-covariance Haario adaptive Metropolis), `slice.js` (coordinate-wise slice sampling), `hmc.js` (Hamiltonian Monte Carlo with `diag`/`dense` metric adaptation), `nuts.js` (No-U-Turn Sampler), `mala.js` (Metropolis-adjusted Langevin), `gibbs.js` (systematic-scan Gibbs), `ars.js` (adaptive rejection sampling — not an `MCMC` subclass), `_leapfrog.js` (shared leapfrog integrator for NUTS), `parallel-tempering.js` (replica-exchange coordinator over an array of replicas), `run-chains.js` (multi-chain driver), `gelman-rubin.js` (R-hat convergence diagnostic).
- `src/location/`, `src/dispersion/`, `src/shape/`, `src/dependence/` — Statistical summary measures (mean, median, variance, skewness, Pearson, Spearman, Kendall, etc.).
- `src/test/` — Statistical hypothesis tests (Bartlett, Levene, Brown-Forsythe, Mann-Whitney, HSIC).
- `src/ts/` — Time series: online covariance.

**Module pattern:** Each namespace has an `index.js` that re-exports named functions from sibling files. Distribution index exports all constructors by PascalCase name. Private helpers are prefixed with `_` (e.g. `_gamma.js`, `_normal.js`).

**Distribution naming:** File names are kebab-case (`log-normal.js`); exported class names are PascalCase (`LogNormal`). Pre-computed table distributions extend `PreComputed` from `_pre-computed.js`.

## Adding a New Distribution

Every new distribution is a **complete implementation** — no partial stubs, no deferred methods. ranjs advertises that all distributions expose the full public API; shipping a distribution with missing methods is a contract violation regardless of how obscure the method seems.

### Implementation checklist

Every subclass of `Distribution` **must** implement all of the following that apply:

| Method | Required | Rule |
| --- | --- | --- |
| `_pdf(x)` or `_pmf(x)` | Always | Probability density / mass function |
| `_cdf(x)` | Always | Cumulative distribution function |
| `_generator()` | Always | Direct or compound sampler for `sample()` |
| `_q(p)` | When a closed form exists | Implement whenever the inverse CDF has a closed form. Omit only when numerical inversion is genuinely the only option. |
| `static _fitInit(data)` | **Always — never omit** | The base class throws `Error` if this is missing, silently breaking `.fit()` for all callers. Use the **exact MLE** if one exists (and add `static get _fitInitIsExact() { return true }`). Otherwise use **method-of-moments** or moment-matching — an approximate initializer is always better than a thrown error. |
| `mean()`, `variance()`, `skewness()`, `kurtosis()` | When analytical formulas exist, or when moments are undefined/infinite | The base class provides a numerical fallback (tanh-sinh quadrature for continuous, compensated summation for discrete), but it is slow (multiple integrations per call) and **cannot detect divergence** — a truncated integral always returns a finite number. Override with a closed-form formula whenever one is available. **Must** override when a moment is mathematically undefined (return `NaN`) or diverges (return `Infinity` / `-Infinity`); failing to do so causes the fallback to silently return a plausible-looking but wrong finite value. Use `NaN` for undefined moments (e.g. Cauchy mean), `Infinity` for divergent moments (e.g. Lévy variance), and a finite number for finite moments (e.g. Normal mean = μ). JSDoc `@returns` is required on each override by the linter. |

**`_fitInit` is not optional.** It is not a nice-to-have. It is not something to file as a follow-up. Every distribution shipped without it has a broken `.fit()` method.

### Test checklist

| Item | File | What to add |
| --- | --- | --- |
| Distribution test cases | `test/dist-cases-continuous.js` or `test/dist-cases-discrete.js` | Entry with `invalidParams`, `params`/`cases` (each with `refVals` and `quantileVals`), and `sampleParams` |
| Precision gate | `test/precision-continuous.js` or `test/precision-discrete.js` | 3 parameter sets × 5 interior points each, with `pmf`/`pdf`, `cdf`, and `qp` (= `cdf(k) − pmf(k)/2`) values derived from **mpmath at `mp.dps=50`** — never from the ranjs implementation itself. The canonical workflow is: add the PMF definition to `scripts/precision-refs-discrete.py` (or `-continuous.py`) and run `python3 scripts/precision-refs-<type>.py` to regenerate the JS file. If mpmath is unavailable, exact rational arithmetic is an acceptable substitute for distributions whose PMF has closed-form rational values. |
| Fit test | `test/dist-base-fit-1.js`, `-fit-2.js`, or `-fit-3.js` explicit block (inside `describe('Distribution', () => { describe('.fit()', ...) })`; add to whichever of the three files is currently smallest, to keep them balanced) | Explicit test alongside the other per-distribution tests — sample from the distribution, call `.fit()`, assert the result is a correct instance. This block is **not** auto-generated from `dist-cases-*.js`; add it by hand. |
| Subpath export | `package.json` `exports` field | `"./dist/<name>": { "import": "./dist/<name>.esm.js" }` in alphabetical order |
| Named export | `src/dist/index.js` | Add (or uncomment) the export line |
| CHANGELOG entry | `CHANGELOG.md` `## [Unreleased]` section | A `### Added` bullet describing the new distribution. New distributions are always user-visible — a changelog entry is mandatory. |

### Other required updates

- **README.md** — The numerical precision section contains hardcoded distribution counts ("All N discrete distributions", "All M continuous distributions"). Increment the relevant count when adding a new distribution.
- **JSDoc** — The class must have `@class`, `@memberof ran.dist`, and `@constructor` tags. The `constructor()` method must have a JSDoc block with `@param` tags for each parameter. Without these, TypeScript declarations will be incomplete. See the TypeScript Declarations section for details.

### Pre-PR verification

Run all four before opening a PR for a new distribution:

```bash
npm run standard                        # no lint errors
npm run jsdoclint                       # JSDoc annotations valid
npm test                                # all tests pass, coverage thresholds met
node scripts/check-subpath-exports.js  # package.json subpath in sync
```

## Adding a New Process or MCMC Sampler

`src/process/` and `src/mc/` deliberately do **not** follow the distribution completeness rule. A `Distribution` subclass must implement the full public API; a `Process` implements only what it has a closed form for and inherits a throwing hook for everything else. Partial rollout is the intended design (`decisions/0040-process-marginal-distribution-instance.md`, `decisions/0044-process-fit-static-factory.md`, `decisions/0046-process-lnl-transition-likelihood.md`) — do not bolt a numerical fallback onto a hook to make it "work" for a process whose law has no closed form.

### Process implementation checklist

| Method | Required | Rule |
| --- | --- | --- |
| `_next()` | **Always** | One-step update rule. The only unconditionally required hook — `next()`, `path()`, and `ensemble()` all run through it. |
| `mean(t)`, `variance(t)`, `covariogram(s, t)` | When a closed form exists | Throw-by-default on the base class. Override with the formula derived from the SDE / update rule. |
| `pdf(x, t)` | When the time-`t` marginal has a closed-form density | Throw-by-default. `CompoundPoisson` deliberately omits it and exposes only `marginal(t)`. |
| `marginal(t)` | When the marginal is a known `ran.dist` law | ADR-0040. Return a `Distribution` instance so `quantile()`/`hazard()`/`survival()`/`test()` come free rather than duplicating that machinery. `throw` — not `NaN` — for a `t` where the marginal is not a genuine continuous distribution (`t <= 0` everywhere; additionally `t >= T` for `BrownianBridge`). |
| `static fit(path, dt)` | When a closed-form estimator exists | ADR-0044. **Opt-in, unlike `Distribution._fitInit`** — there is no numerical optimizer to seed, so a process with no closed-form estimator correctly keeps the throwing default. Name the estimator honestly in the JSDoc and CHANGELOG (`CoxIngersollRoss`'s is Conditional Least Squares, *not* MLE). |
| `_transitionLnPdf(xPrev, xNext)` | When the one-step transition density is closed form | ADR-0046. `lnL(path)` is implemented once on the base class over this hook — override `_transitionLnPdf`, never `lnL` itself. |

**The contrast with `_fitInit` is the point.** `_fitInit` is mandatory for every `Distribution` because the base class has a numerical optimizer that is broken without it. `Process` has no such machinery behind `marginal()`, `static fit()`, or `_transitionLnPdf()`, so those stay throw-by-default hooks and a subclass that cannot implement one leaves it alone. Half of the current processes implement none of the three.

### Process test checklist

| Item | File | What to add |
| --- | --- | --- |
| Reference values | `test/process-cases.js` | Entry with `name`, `ctor`, and `refs`. Each ref carries `should` (prose completing the mocha title), `params` (a **thunk** returning constructor arguments, so no instance — and no PRNG — is built at import), `method`, `args`, optional `chain`/`chainArgs` (for `marginal(t).pdf(x)`), `expected`, `tol`, and `source`. `source` is passed as the assertion message, so provenance shows up in failure output instead of only in a comment a reader has to find. Consumed by a plain inline `forEach` at the end of `test/process.js` — there is no `dist-runner.js`-style shared runner, and at 9 processes there should not be one. |
| Precision gate | `test/precision-process.js` | Generated — see below. |
| Behavioural tests | `test/process.js` | Contract behaviour the precision gate does not probe: `NaN` for `t <= 0`, exact `0` outside the support, `Infinity` at a collapsed endpoint, symmetry about the mean. Sampled moments go through `assertSampleMoments` at the fixed `MOMENT_SEEDS = [0, 42, 12345]`, compared against a closed form derived independently from the SDE with a CLT-derived `K_SIGMA = 8` tolerance — never against the process's own `mean()`/`variance()`, which would be a tautology. |
| Subpath export | `package.json` `exports` field | `"./process/<name>": { "import": "./dist/process/<name>.esm.js" }` in alphabetical order. Verified by `node scripts/check-subpath-exports.js`, which covers `process` and `mc` as well as `dist`. |
| Named export | `src/process/index.js` | Add the export line |
| CHANGELOG entry | `CHANGELOG.md` `## [Unreleased]` section | Mandatory — a new process is user-visible |

### Process precision gate

The `src/process/` analogue of the distribution precision gates, and held to the same standard:

- **The generator is the source of truth.** Add the marginal law to `scripts/precision-refs-process.py` and run `python3 scripts/precision-refs-process.py` to regenerate `test/precision-process.js` wholesale. Never hand-edit the generated file. A full run takes ~7 minutes (CompoundPoisson's Tweedie bisection dominates); `--render` re-emits from the `/tmp/precision-process-cache.json` cache without recomputing, which is enough for a tolerance or template edit.
- **Grid**: 3 parameter sets × 3 times × 5 interior points, computed with **mpmath at `mp.dps = 50`** and rounded to float64. Probes are `F_t^-1(p)` for `p ∈ {0.1, 0.3, 0.53, 0.72, 0.9}` — off-centre by design, so a symmetric process's median never becomes the probe. A discrete process is probed at the integer `k`-values those levels select.
- **Tolerance is `1e-14` relative error.** A group may set a looser `pdfTol`/`cdfTol` (they default to the group's `tol`) only with a comment naming the measured worst case and the numerical reason — `RandomWalk` at 3e-14 for log-gamma ULP amplification, `CompoundPoisson`'s pdf at 6e-14 for the Dunn & Smyth infinite series — and never looser than 1e-12.
- **Every reference gates three independent code paths**: `pdf(x, t)`, `marginal(t).pdf(x)`, and `marginal(t).cdf(x)`. `marginal()` re-derives the law's parameters separately from `pdf()`, so checking it only against `pdf()` would let a shared parameterization slip cancel out. A group with `procPdf: false` has no `pdf(x, t)` of its own and runs only the latter two.
- **Reference math must be independent of ranjs.** The generator re-derives each marginal from the process's own SDE / update rule and self-checks those derivations against externally sourced values before emitting a single literal. Never read a reference off the JavaScript implementation.
- Increment the process count in README.md's numerical precision section.

### MCMC test rigor

`src/mc/` has no precision gate: a sampler's output is stochastic, so there is nothing to pin at 1e-14. Two conventions carry the rigor instead.

- **Deterministic exact-reference tests for integrators and diagnostics.** Any `src/mc/` component that is a *pure function* of its inputs — the leapfrog integrator in `hmc.js`/`nuts.js`, `gelmanRubin` — must have a hand-derived exact-reference test alongside its statistical tests: fixed inputs, the closed-form result asserted to `1e-12`–`1e-14`, and the full rational derivation spelled out in the comment (`._leapfrog() deterministic single-step correctness` in `test/mc/hmc.js`, `hand-computed reference` in `test/mc/gelman-rubin.js`). Statistical tests cannot substitute: a KS test on a well-scaled target passes even when the integrator dots raw momentum instead of metric-scaled velocity, the blind spot ADR-0034 names explicitly. **Pick inputs that break degeneracy** — the leapfrog tests use a non-identity metric (`variance = 4`) precisely because under an identity metric the wrong formula produces the right numbers.
- **Fixed seed sweeps for every statistical assertion.** `ksTest` at α = 0.01 has an inherent ~1% false-positive rate per unseeded call. Every distributional / margin-recovery KS assertion sweeps the pre-verified `SEEDS = [0, 42, 12345]` exported from `test/mc/_helpers.js` (Gibbs uses `[0, 7, 42]`, for the reason given at that block), so a real regression must reproducibly break at least one of three independent trajectories. Never hand-pick a single seed because it happened to pass.

A new sampler needs the same `package.json` subpath export (`"./mc/<name>"`), `src/mc/index.js` export, and CHANGELOG entry as a new process.

## Return Value and Error Conventions

Every public function and method signals "no ordinary result" through exactly one of four channels. Pick the channel by **what kind of situation occurred**, not by convenience. See `decisions/0015-return-value-and-error-conventions.md`.

| Situation | Channel | Rationale |
| --- | --- | --- |
| **Caller/programming error** — invalid or missing parameters, failed constraint, wrong arity, dimension mismatch, structurally impossible input (e.g. negative count) | **`throw Error(...)`** | Fail fast and loud. The caller has a bug that must be fixed, not handled at runtime. Matches the constructor contract (ADR-0004). |
| **Valid in-domain query, but the answer is mathematically indeterminate / does not exist** — mean of Cauchy, skewness of a point mass, `0/0` | **`NaN`** | Keeps numeric methods typed `number` (the `.d.ts` are generated from JSDoc). Matches SciPy/R and JS-native math (`Math.sqrt(-1)`). |
| **Valid query, but the answer diverges** — variance of Pareto with α ≤ 2, every moment of Lévy | **`Infinity` / `-Infinity`** | Carries strictly more information than `NaN`: "grows without bound" ≠ "no value at all". Never collapse divergence to `NaN`. |
| **The mathematically correct value happens to be zero** — pdf/cdf/pmf evaluated outside the support | **`0`** | Not an error: probability really is zero there. Do not throw or return `NaN`. |

**`undefined` is not an error sentinel.** Do not return `undefined` to mean "computation failed" or "value does not exist". It breaks generated TypeScript types (forces `number | undefined` across the whole numeric API), is silently dropped by `JSON.stringify`, and is foreign to the numerical-computing idiom. `undefined` is acceptable *only* for a genuinely optional/absent value where the caller is expected to branch on presence — never as a stand-in for `NaN`, `Infinity`, or a thrown error.

**Applies everywhere, not just distributions.** `ran.core`, `ran.special`, `ran.algorithms`, and `ran.la` follow the same split: `throw` for contract violations (wrong arity, dimension mismatch, impossible input); `NaN`/`±Infinity` for out-of-domain or divergent math. **Never wrap hot numeric loops in `throw`/`try` for ordinary out-of-domain inputs** — let the math produce `NaN`/`Infinity`.

## Testing Conventions

- Tests live in `test/` and mirror `src/` module structure.
- Mocha test runner with Chai `assert` for assertions.
- `test/test-utils.js` — shared helpers: `ksTest`, `chiTest`, `repeat`, `Tests`.
- `test/dist-cases-continuous.js` and `test/dist-cases-discrete.js` — per-distribution test case definitions (`name`, `invalidParams`, `params`, `cases`), split by distribution type.
- `test/dist-runner.js` — shared `registerDistributionTests(testCases)` used by the shard files to register the constructor/seed/load-save/analytical/sample/test/moments/fit tree for each case.
- `test/dist-shard-0.js` .. `test/dist-shard-3.js` — deterministically partition `[...continuousCases, ...discreteCases]` by index modulo 4 and run their slice through `dist-runner.js`, so `mocha --parallel` can execute the full distribution suite across worker processes.
- `test/dist-base-*.js` — the non-distribution-suite tests, split out of a former monolithic `dist-base.js` to stay under CodeScene's per-file Code Health thresholds (see issue #1072): `dist-base-core.js` (base `Distribution` instance methods other than `.fit()`/`.params()`), `dist-base-fit-1.js`/`-fit-2.js`/`-fit-3.js` (the `.fit()`/`_fitInit` block, split into three roughly-equal parts), `dist-base-params.js` (`.params()`), `dist-base-special-cases.js` (`PreComputed`, `Degenerate`, `Kolmogorov`, `_qEstimateWalk`), `dist-base-paramcount.js` (Lindley/Mielke/Davis and the multi-level-inheritance parameter-count regressions), `dist-base-fit-gate.js` (the `fit()` precision and robustness gate), and `dist-base-sharding.js` (the `dist-shard-*.js` partition regression guard).
- `test/process-cases.js` — externally-sourced reference values for `ran.process` analytical methods (issue #1221), consumed by a plain inline `forEach` at the end of `test/process.js`.
- `test/precision-continuous.js`, `test/precision-discrete.js`, `test/precision-special.js`, `test/precision-summary-stats.js`, `test/precision-process.js` — precision gates pairing a `REFS` array of mpmath-derived reference values with an inline `forEach` consumer in the same file, rather than a separate runner module.
- **Shared runner vs. data-file-plus-inline-loop**: the codebase has two structured-case patterns. Use a shared runner module (`dist-runner.js`) only when more than one file consumes the same cases, as the four `dist-shard-*.js` files do. Otherwise pair a plain array of case objects with an inline `forEach` that builds `describe`/`it` directly, as `test/process-cases.js` and the five `test/precision-*.js` files do — a runner with a single caller is an abstraction boundary nothing needs. See the rationale recorded in the header comment of `test/process-cases.js`.
- **Behavior-first assertions**: assert on the output of public methods given known inputs (hand-calculated expected values), not on internal state.
- **Statistical verification**: use `ksTest` (Kolmogorov-Smirnov) for continuous distributions and `chiTest` (chi-squared) for discrete distributions when verifying that `sample()` produces correctly distributed values.
- **New distributions must be added to the appropriate `test/dist-cases-*.js` file** with `invalidParams`, `params`, and `cases` entries before any implementation is written (TDD).
- **No 100% line coverage enforcement** — test for meaningful behavior, not line counts.
- **Reference values must be externally sourced**: All non-trivial numeric values in `closeTo` assertions — whether in distribution tests, process tests, or elsewhere — must be derived from one of three external tools: (1) **mpmath at `mp.dps=50`**, (2) **scipy**, or (3) **R**. Mark each with a comment naming the tool and showing the computation, e.g. `// mpmath mp.dps=50: exp(0.3) → 1.3498588075760032`. Exact rational results (e.g. `sigma²·t = 4·3 = 12`) are self-documenting and require only an `// exact rational: <formula>` comment. Never derive a reference value from the ranjs source itself, and never write the same formula in both the production method and the test assertion — such tests pass even when the formula is wrong.

## GitHub Issues

- **Always use the `ops-issue` agent** when creating GitHub issues. Never call `gh issue create` directly.
- Every issue must have a **priority** label (`high`, `medium`, `low`) and a **difficulty** label (`difficult`, `moderate`, `trivial`).
- Breaking-change issues also get a **`breaking`** label. Breaking means: constructor or public-method rename/removal, intentional parameter convention changes, or changed return shapes. Bug fixes — including wrong-formula corrections — are not breaking even if they change computed values; document them in the changelog instead. The `breaking` label is a **severity/communication marker**, not a milestone router — breaking changes ship in ordinary minor releases (see "Versioning"), so they get the same milestone as everything else.
- A breaking change must first ship a **deprecation cycle** before the old behavior is removed. The issue that *introduces the deprecation warning* gets the `breaking` label; a separate follow-up issue (one release later) does the actual removal. See "Versioning and Changelog" for the cycle rules.
- Every issue must be assigned to the **current next-release milestone** (the lowest open `vX.Y.0`). There is no separate breaking-change milestone. The `ops-issue` agent sets this automatically. A GitHub Actions workflow (`.github/workflows/require-milestone.yml`) flags any issue opened without a milestone.
- **One concern per issue.** Reject titles that contain `+`, "and", or comma-separated lists of changes.
- **PR size cap is enforced via the issue template.** Production-code diff must stay under ~400 lines (tests excluded). If a feature can't fit, decompose before filing.
- **Mandatory bug triage on every fix/hotfix/build.** `/hotfix`, `/fix`, and `/build` each have a dedicated **Bug Triage** stage that invokes the `ops-triage` agent to classify observations into `definite` / `ambiguous` / `not_a_bug`. `definite` bugs are auto-filed via `ops-issue` in a batch; `ambiguous` cases are escalated to the user in a single prompt; `not_a_bug` is silent. Do not skip the stage even if the session feels clean — the agent will skim the diff for red flags as a safety net.

## Decomposing Cross-Cutting Changes

When a change touches many files (new base class method, convention rename across all distributions, refactor across all statistical modules), decompose:

**Abstract-method-first rollout** (preferred for new methods on `Distribution` or other base classes):
1. **Issue 1**: Add the new method on the base class with a default or `throw new Error('Not implemented')`. No subclass changes. Tiny PR.
2. **Issues 2..N**: Implement the method for one distribution (or one related family) per issue. Each PR small and independently revertable.
3. **Issue N+1**: Finalize or tighten the base class once all subclasses are migrated.

**Prerequisite extraction** (preferred for new distributions needing new special functions or algorithms):
1. File the special function or algorithm as its own prerequisite issue first.
2. Merge the prerequisite.
3. The distribution issue's `Scope` assumes it exists, keeping the distribution PR focused on the statistical math itself.

**Vertical slicing only** (for a single distribution or feature):
- Do **not** split a distribution's `_pdf`/`_pmf` from its `_cdf` — they are one coherent unit that must be tested together.
- Slice by *dependency stage* (algorithm → special function → distribution → tests), not by method surface.

**Documentation updates as follow-ups:**
- `README.md` and `CLAUDE.md` updates file as separate issues, not part of the feature PR. Doc-only PRs review in seconds.

## Versioning and Changelog

**Release model: batched.** PRs are merged without bumping the version. When enough changes have accumulated, a dedicated release PR bumps the version, promotes `[Unreleased]` to the new version, and triggers the npm publish.

**Versioning policy: numpy/scipy-style (NEP 23 / SPEC 0).** Breaking API changes are allowed in **minor** releases — we do **not** reserve a `vX.0.0` bump for each breaking change. The cost of doing so safely is a mandatory deprecation cycle (below). A major bump is reserved for rare, sweeping overhauls (the way numpy went 1.x → 2.0 once in ~18 years), not for individual breaking changes.

**Semver tiers:**
- **Patch** (`x.y.Z`): dependency updates, bug fixes, internal refactors with no API change.
- **Minor** (`x.Y.0`): new distributions, new public methods, additive API changes, **and breaking changes that have completed their deprecation cycle.**
- **Major** (`X.0.0`): reserved for a sweeping, library-wide overhaul. Individual breaking changes do **not** trigger a major bump.

**Deprecation cycle (required before any breaking removal):**
1. **Introduce the warning.** In one minor release, keep the old behavior working but emit a `console.warn('[ranjs] <thing> is deprecated and will be removed in vX.Y.0; use <replacement>.')` on first use. Add a `### Deprecated` bullet to `CHANGELOG.md` naming the target removal version. The issue doing this carries the `breaking` label.
2. **Hold.** The warning must remain for **at least one** released minor version so downstream users see it before the behavior changes.
3. **Remove.** In a later minor release, a separate follow-up issue removes the old behavior. Add a `### Removed` changelog bullet referencing the deprecation. Never collapse steps 1 and 3 into a single release.

Truly unavoidable immediate breaks (e.g. a security fix with no compatible path) may skip the cycle, but must be called out explicitly in the changelog with the rationale.

**Per-PR changelog rule:** If a PR makes a user-visible change (bug fix, new feature, dependency security fix, removed dead code), add a bullet to the `## [Unreleased]` section of `CHANGELOG.md` following the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format. Pure refactors, test-only changes, and doc-only changes do not need a changelog entry.

**Changelog entry placement:** Always add new entries under the existing `### Added`, `### Changed`, `### Fixed`, etc. subsections — never create a duplicate subsection. If the new change is the same category as an existing entry (e.g. another `_fitInit` seed, another `refVals` addition, another cancellation fix), extend or amend that entry rather than adding a separate bullet. The goal is one bullet per logical group, not one bullet per distribution or per file.

**Release PR:** Rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`, add a new empty `## [Unreleased]` above it, and bump `version` in `package.json`. For vulnerabilities that cannot be fixed without a breaking toolchain change, document the accepted risk in the changelog entry with a reference to the tracking issue.

**Triggering a release:** Use the `/release` skill from a machine where `gh` and `git` are available. It handles the full pipeline end-to-end: version bump, changelog, release PR, merge, tag, and milestone rotation. Run it as:
```bash
/release          # bumps minor automatically (1.24.6 → 1.25.0)
/release 1.25.0   # explicit version
```
The skill pushes `v{version}` which triggers `.github/workflows/release.yml` (lint → typecheck → tests → `npm publish --provenance`). Prerequisites: an `NPM_TOKEN` **granular access token** (not a classic automation token) must be stored in GitHub repository Settings → Secrets → Actions, and tag protection rules must restrict `v*` tag creation to maintainers (Settings → Rules → Tag protection).

## Documentation

- When adding, removing, or modifying files in `.claude/skills/` or `.claude/agents/`, update `.claude/README.md` to reflect the change.
- Keep `README.md` up to date whenever changes warrant it (new distributions, changed API, new modules).
- JSDoc-style comments on the `Distribution` base class and major public methods follow the existing format in `src/dist/_distribution.js` (class/method tags, `@param`, `@returns`, `@memberof`).

## TypeScript Declarations

TypeScript declarations are **generated** from JSDoc annotations via `tsc --allowJs --declaration --emitDeclarationOnly` as part of `npm run build`. The entry point is `dist/index.d.ts` (one `.d.ts` per source file, rooted at `src/index.js`). See `decisions/0010-jsdoc-driven-declaration-generation.md`.

**Maintenance rules:**
- When adding a new distribution, give the class an explicit name: `export default class MyDist extends Distribution`. Do not use anonymous `export default class extends`.
- Every distribution constructor must have a JSDoc block with `@param` tags directly on the `constructor()` method (not only on the class-level JSDoc). tsc only reads `@param` from the constructor method's JSDoc block for constructor typing.
- JSDoc union types must use `{number|string}` syntax — not `{(number|string)}` (extra parens are ignored by tsc).
- `@overload` JSDoc blocks before a function/method produce typed overload signatures in the generated declaration.
- Run `npm run build && npm run typecheck` after any JSDoc annotation changes to confirm the generated declarations are correct.
- `tsconfig.json` is for typecheck only (`"noEmit": true`) and resolves `ranjs` imports via `paths` pointing at `dist/index.d.ts`. `tsconfig.build.json` is the separate config that drives declaration generation.

## Communication Style

- **Be brutally honest.** Never sugarcoat answers, even if the truth is uncomfortable. If an idea is bad, say so directly and explain why. If a formula is wrong, say it is wrong.
- **Back opinions with evidence.** Cite numerical analysis principles, statistical references, or established mathematical results when pushing back. "This formula produces biased estimates because..." is better than "this might not be ideal."
- **Reject bad ideas explicitly.** Do not find ways to make a bad idea work just to be agreeable. Say "this is the wrong approach because..." and propose what to do instead.

## Test-Driven Development

**Always follow TDD (red-green-refactor) for all implementations:**

1. **Red** — Write the failing test(s) first. Add `invalidParams`, `params`/`cases`, `moments`, and `fit` entries to the appropriate `test/dist-cases-*.js` file, and any explicit `.fit()` blocks to whichever of `test/dist-base-fit-1.js`, `-fit-2.js`, or `-fit-3.js` is currently smallest, **before writing a single line of implementation code**. Run `npm test` and confirm the test suite fails with the expected errors (missing export, not-a-function, assertion failures). A test that passes before the implementation is written is not a test — it's dead code.
2. **Green** — Write the minimal implementation that makes the tests pass. No extra methods, no speculative abstractions — only what the red tests require. Run `npm test` and confirm all tests pass.
3. **Refactor** — Clean up the implementation (rename for clarity, extract shared constants, simplify expressions) without changing behaviour. Run `npm test` after each refactor step to confirm nothing broke.

This cycle applies to every new distribution, every new method, every bug fix. Do not write implementation code before you have a red test that demands it.

## Workflow

- When editing multiple files, make all independent edits in parallel.
- When performing multi-step tasks, show a progress list with checkboxes (e.g., `- [x]` done, `- [ ]` pending) and update it as you go.
- **Always use selectable options** (via the `AskUserQuestion` tool) when asking the user to make a choice or design decision during planning or implementation. Never ask the user to type their choice as free text. Always include a final option labeled "Other" or "Type something" so the user can provide a custom answer if none of the options fit.
- **Never stop mid-pipeline.** When a sub-skill (`/commit`, `/push`, `/pr`, etc.) is invoked from within a parent skill (`/hotfix`, `/build`, `/implement`, etc.), continue executing the parent workflow immediately after the sub-skill returns. Do not pause for user input between steps unless the parent skill explicitly requires it. Do not output text that implies completion (e.g. "Done!", "Committed!") between steps — save all status reporting for the parent skill's final report.
- **`/review` vs `/code-review`**: `/code-review` is for standalone ad-hoc reviews only (e.g. the user types `/code-review` directly). When a parent skill (`/fix`, `/hotfix`, `/build`, `/implement`) instructs you to run a review step, **always** invoke `/review` via the Skill tool — never `/code-review`. `/review` runs spec-compliance + 8 parallel specialized agents; `/code-review` runs a single-agent inline scan and is not a substitute inside pipelines.

## Code Style

- Standard.js formatting enforced via `npm run standard`. No semicolons, 2-space indentation.
- **WHY-only comments.** Inline comments must explain *why* code exists or *why* this approach was chosen — never *what* the code does. Code already says what; comments must say why. Good: `// Neumaier compensated sum avoids catastrophic cancellation for very large N`. Bad: `// sum the array`.
- JSDoc comments on public Distribution methods follow the existing format. Skip on simple utility functions where name + parameters are self-explanatory.
- **`_` prefix convention.** The `_` prefix signals "not part of the public API" and covers two distinct access levels that JavaScript cannot express separately. On *files*, it means module-private — the file is not re-exported by the namespace `index.js` (e.g. `_gamma.js`). On *class methods*, the `_` prefix means one of two things: **protected** — a hook that subclasses are expected to override (e.g. `_pdf`, `_cdf`, `_generator`, `_fitInit`, `_afterLoad`); or **private** — a base-class implementation detail that subclasses should not touch (e.g. `_momentBounds`, `_belowSupport`). The JSDoc tag (`@protected` vs `@private`) is the authoritative signal when the distinction matters.
- **Method ordering in `Distribution` and its subclasses.** Methods must appear in this order: `constructor` first, then six sections separated by `// ─── LABEL ───` divider comments: (1) **PUBLIC INSTANCE** — all public instance methods the end user calls; (2) **PUBLIC STATIC** — `validate`, `load`, `fit`, and any other public static factory/utility methods; (3) **PROTECTED INSTANCE** — hooks subclasses override (`_generator`, `_pdf`, `_cdf`, `_qInitialGuess`, `_qEstimateWalk`, `_afterLoad`); (4) **PROTECTED STATIC** — hooks subclasses override statically (`_fitInit`, `_fitInitIsExact`, `_fitPenalty`); (5) **PRIVATE INSTANCE** — base-class internals not meant for subclasses; (6) **PRIVATE STATIC** — base-class static internals. Rationale: the two audiences (end users and distribution authors) each find what they need in the first sections they read, without wading through internals. Apply the same ordering to all classes in the codebase: omit sections that have no methods. Add `// ─── LABEL ───` divider comments only in large classes where sections don't fit on one screen without scrolling — `_distribution.js` is the canonical example. In short classes the ordering alone is sufficient.
- Type hints are not used — plain JavaScript.

## Code Health

Whenever you edit or create a `.js` file, check its Code Health immediately after saving:

1. Call the CodeScene `code_health_score` tool on the file.
2. If the score is **below 10.0**, call `code_health_review` on the same file and fix the identified code smells following the guidance it returns (boy scout rule — leave the file healthier than you found it).
3. After fixing, re-run `npm run standard` and `npm test` to confirm nothing broke.

This rule applies to every `.js` file touched in any session, regardless of whether the edit was a bug fix, refactor, new feature, or incidental touch. If a smell cannot be fixed within reasonable scope (e.g., a god file that would require a major cross-file refactor), document why in the PR description and proceed.

When the user asks about the code health of a file or requests a code health review, always use CodeScene's MCP server: call `code_health_score` to get the score, and `code_health_review` to get the detailed review with identified smells and improvement guidance.

## Architecture Decision Records (ADRs)

ADRs capture significant design decisions and their rationale. They live in `decisions/` and follow the Nygard format.

- **When to write an ADR:** When a decision affects the public API of `Distribution` or another base class, the module export structure, conventions for how parameters/support/constants are stored, cross-cutting codebase conventions, or introduces/removes a dependency. Do **not** write an ADR for implementation-technique choices (e.g., which numerical approximation to use inside a single function, which root-finding algorithm to call) — those belong in a commit message or solution file.
- **Format:** Use the template at `decisions/0000-template.md`. One decision per file, numbered sequentially.
- **Status lifecycle:** Proposed → Accepted → (Superseded or Deprecated). Accepted ADRs are immutable — supersede, don't edit.
- **Who writes them:** The `/plan` skill produces ADRs automatically for non-trivial design decisions. For manual work, write the ADR before or alongside the implementation.
- **Inline references:** After writing an ADR, add a reference at the most relevant code location — a WHY comment at the affected class/function. Use the relative path format: `decisions/NNNN-slug.md — one-line rationale`.
- **PR gate:** Non-trivial PRs must reference at least one ADR. The `/pr` skill enforces this.
- **Location:** `decisions/` at the repo root.
