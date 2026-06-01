# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `riemannZeta` now uses a two-term Laurent expansion (`1/(s−1) + γ − γ₁·(s−1)`) when `|s−1| < 0.01`, eliminating 4-digit precision loss caused by catastrophic cancellation in the denominator `1−2^(1−s)` near the pole (#551).

### Changed

- `RaisedCosine` and `Moyal` `_generator()` now use exact inverse-CDF samplers instead of rejection sampling: `RaisedCosine` uses Chandrupatla's bracketed root-finder on the standardised support [−1, 1]; `Moyal` uses `erfinv` to invert the `erfc`-based CDF analytically. Eliminates the silent-failure risk of the 100-iteration rejection cap (#548).
- `lambertW1m` Halley stopping criterion changed from pure-relative (`|Δw/w| < ε`) to hybrid absolute/relative (`|Δw| < ε·max(|w|,1)`) to avoid false convergence near w = 0; W₋₁ initial guess replaced with a region-adaptive approximation — Corless et al. (1996) branch-point series for z ∈ [−1/e, −0.1], logarithmic Laurent for z ∈ (−0.1, 0) — improving convergence from ~10 iterations to 2–3 (#550).
- Root-finding in `src/algorithms/` now uses Chandrupatla (1997) instead of the previous incomplete Brent implementation. The new algorithm correctly handles roots near zero with a mixed absolute/relative stopping criterion (`|dx| < ε·max(|x|,1)`), throws on invalid brackets (same-sign endpoints) instead of silently returning `NaN`, and returns the best approximation after iteration budget exhaustion (#541).
- Replaced adaptive trapezoidal doubling (`src/algorithms/trap.js`) with double-exponential (tanh-sinh) quadrature (`src/algorithms/tanh-sinh.js`). The new algorithm achieves machine-epsilon precision in ~7 refinement levels (≤500 evaluations) versus the trapezoidal method's worst-case 2^24 evaluations, and naturally handles endpoint singularities (#542).
- `recursiveSum` stopping criterion changed from pure relative (`|Δ/sum| < ε`) to hybrid absolute/relative (`|Δ| < ε·max(|sum|, 1)`). The old criterion required terms to shrink to `ε·|sum|` before stopping, which stalls convergence when the series sum is near zero — as occurs in noncentral β, t, χ², Von Mises, and hypergeometric series at cancellation points (#543).
- Newton's method stopping criterion changed from pure relative (`|dx/x| < ε`) to hybrid absolute/relative (`|dx| < ε·max(|x|, 1)`). The old criterion produced `NaN` when `x = 0` (causing the loop to always run to `MAX_ITER`), and for `|x| < 1` demanded convergence tighter than machine precision. Used by `erfinv` and the Marcum-Q truncation-number computation (#549).
- `Distribution.fit()` now uses Powell's conjugate-direction optimizer instead of Nelder-Mead (`src/algorithms/powell.js` replaces `nelder-mead.js`), and returns the **exact closed-form MLE** directly — skipping the optimizer entirely — for 20 distributions whose estimator is closed-form: Exponential, Normal, Poisson, Bernoulli, DiscreteUniform, Pareto, LogNormal, Rayleigh, MaxwellBoltzmann, HalfNormal, Geometric, Laplace, Reciprocal, Lindley, Uniform, InverseGaussian, LogitNormal, PowerLaw, Borel, and BorelTanner. As a result `fit()` may return slightly different — strictly more accurate — parameter estimates: closed-form distributions are now exact to machine precision, and Powell finds tighter optima (no simplex stalls) on the rest. `Uniform`, `InverseGaussian`, and `PowerLaw` `_fitInit` were corrected to their exact MLEs (`[min, max]`; `λ̂ = n/Σ(1/xᵢ − 1/x̄)`; `â = −1/mean(log x)`). See ADR-0016 (#546).
- `besselI(n, x)` normalisation switched from the `_I0(x)` Taylor series (capped at 100 iterations, wrong for x ≳ 200) to an in-sweep accumulated sum `S = f_0 + 2*(f_1+f_2+…)` with log-exp normalisation `I_n = f_n * exp(x − log(S))` (DLMF 10.35.3). Also fixes `besselI(0, x)` at large x, which previously returned values off by exponentially many orders of magnitude. Relative error now ≤ 1e-10 at x = 50, 100, 200 (#544).

### Removed

- `scripts/bench.js` and the 11 `jstat` / `@stdlib` devDependencies that backed it. The one-time comparative benchmark (issue #114) has served its purpose; keeping the packages inflated `npm install` and triggered false-positive alerts on snyk scans of the repo. ADR-0011 documents the original decision and rationale.

## [1.26.0] - 2026-05-31

### Added

- `Distribution.params()` public method returning the natural parameters of a distribution (#516). All nine `Categorical` subclasses (`Bernoulli`, `Binomial`, `Hypergeometric`, `Soliton`, `Zipf`, `ZipfMandelbrot`, `BetaBinomial`, `NegativeHypergeometric`, `Rademacher`) now expose their own named parameters (e.g. `new Bernoulli(0.7).params()` → `{ p: 0.7 }`) instead of inheriting the internal lookup state from `Categorical`.
- Interactive distribution demo page (`docs/demo.html`): select from 15 curated distributions, adjust parameters, visualise histogram+PDF and empirical+theoretical CDF side-by-side (rendered with dalian), and run MLE fitting via `fit()` to see how closely the fitted parameters match the planted values (#504).
- `Distribution.fit(data)` static method for maximum-likelihood parameter estimation via Nelder-Mead simplex optimizer (#404). Covers all 140 exported distributions. The `static _fitInit(data)` hook lets each distribution seed the optimizer from a data-aware method-of-moments estimate; the base-class fallback draws random positive values until the parameter constraints pass. Together with `sample()` and `test()`, `fit()` closes the full statistical cycle: define → sample → fit → test.
- `static _fitInit(data)` data-aware seeds added to 36 continuous distributions, replacing the base-class random-retry fallback: `InverseGaussian`, `ReciprocalInverseGaussian`, `Nakagami`, `Hoyt`, `Lindley`, `Alpha`, `QExponential` via method-of-moments (#486); `Gompertz`, `Makeham`, `Muth`, `BenktanderII`, `BirnbaumSaunders`, `Davis`, `GeneralizedExponential`, `Rice` via best-effort data-aware seeds (#488); `JohnsonSU`/`JohnsonSB` via the Slifker-Shapiro (1980) quantile method (#440); 9 noncentral distributions seeded from central-case moment equations (#439); 10 bounded-support distributions (`Bates`, `Triangular`, `Trapezoidal`, `PERT`, `BetaRectangular`, `UQuadratic`, `Uniform`, `UniformProduct`, `Anglit`, `RaisedCosine`) seeded from sample extremes (#433).
- `_fitInit` data-aware seeds added to 34 discrete and extreme-value distributions: 22 discrete distributions (#438), 7 Weibull/extreme-value family distributions (#434), and `StudentT`, `StudentZ`, `Degenerate`, `Soliton`, `IrwinHall` from single-moment inversions (#441).
- `gaussLegendre(f, a, b, n)` algorithm: fixed-order Gauss-Legendre quadrature with precomputed nodes and weights for n=5, 10, and 20; exact for polynomials of degree ≤ 2n−1 (#402).
- `fit()` now works on zero-parameter distributions (`Gilbrat`, `HalfLogistic`, `HyperbolicSecant`, `Kolmogorov`, `Rademacher`, `Slash`, `UniformRatio`): `Cls.fit(data)` returns a fresh instance without optimization (#427).
- `Categorical.fit(data)` and `Hyperexponential.fit(data)` now return fitted instances instead of throwing; `Categorical` uses closed-form empirical frequencies, `Hyperexponential` defaults to a two-component mixture initialised by a median split (#428).
- `ConwayMaxwellPoisson` distribution: two-parameter count distribution generalizing Poisson (ν=1), supporting both overdispersion (ν<1) and underdispersion (ν>1). Normalizing constant Z uses a log-space recurrence with running log-sum-exp to prevent silent overflow for λ ≥ ~710 (#420).
- `ZipfMandelbrot` distribution: three-parameter finite discrete distribution with PMF `(k+q)^{-s} / H_{N,s,q}`, generalizing `Zipf` by the shift parameter `q ≥ 0` (#398).

### Changed

- `npm test` now runs under nyc with coverage thresholds enforced (`branches ≥ 92%`, `lines ≥ 98%`, `functions = 100%`, `statements ≥ 98%`); the suite exits non-zero if coverage drops below these baselines (#400).

### Deprecated

- `Distribution.q(p)` called with `p` outside `[0, 1]` now emits a one-time `console.warn`; the current behavior (returning `undefined`) is unchanged this release. The method will **throw** in v1.27.0 (see #594).

### Fixed

- `bracket`, `brent`, and `newton` in `src/algorithms/` now return `NaN` (instead of `undefined`) on failure paths; `quickselect` now throws for an out-of-range index. `Distribution._qEstimateRoot` propagates `NaN` on bracket failure (#589).
- All statistics modules (`location`, `dispersion`, `shape`, `dependence`, `ts`) now comply with ADR-0015: mismatched-length array arguments throw `Error` (caller error), indeterminate results (empty sample, zero-variance) return `NaN`, divergent results (KL divergence with `Q=0,P>0`, zero-denominator odds ratio) return `Infinity`. `undefined` is no longer returned as a failure sentinel from any public function (#593).
- `Davis._cdf(x)` now uses a dual Bose-Einstein series (upper incomplete gamma series for x near μ, Bernoulli/Laurent series for large x) instead of Romberg integration; per-call cost drops from ~100ms to ~10µs, enabling full goodness-of-fit coverage with the standard sample size (#451).
- `Bates.fit()` now uses a profile likelihood grid search over integer `n` instead of the inherited 3-parameter Nelder-Mead, which stalled on the staircase likelihood surface caused by integer rounding; `n` is now reliably recovered (#481).
- `Bradford._fitInit`: small-`c` mean approximation coefficient corrected from `3·(1−2·mean)` to `6·(1−2·mean)`, matching the correct first-order expansion `E[X] ≈ ½ − c/12`; the previous coefficient underestimated the starting value by a factor of 2 (#498).
- `NoncentralChi`: `.p.lambda` now stores `λ` instead of `λ²`; both construction and `.fit(data)` now correctly return the user-facing noncentrality parameter (#491).
- `Mielke`: `aic()`/`bic()` now use the correct parameter count of 2 (not 3 inherited from `Dagum`), and `.p` now correctly exposes `{ k, s }` instead of Dagum's `{ p, a, b }` bag (#480, #505).
- Multi-level `Distribution` subclasses now report the correct free-parameter count `k`, fixing `aic()`/`bic()` for `Weibull` (2), `ExponentiatedWeibull` (3), `Chi2` (1), `MaxwellBoltzmann` (1), `GeneralizedGamma` (3), `LogGamma` (3), `Rayleigh` (1), and `HalfGeneralizedNormal` (2) (#510).
- `R`, `F`, `FisherZ`, and `BaldingNichols` `.fit()` no longer inherit `Beta`'s wrong-arity initializer; each now seeds Nelder-Mead from a distribution-correct method-of-moments estimate (#441).
- `besselISpherical(n, x)` now uses a Taylor series for |x| < 1, eliminating catastrophic cancellation in the closed-form expressions for n ≥ 1; relative error bounded by 2ε (#425).
- `Davis` distribution: `sample()` now produces genuine random variates via an exact Zeta-Gamma mixture sampler instead of always returning `1`; parameter constraint tightened to `n > 1`; `_pdf` NaN guard added for the lower support boundary (#447, #448).
- `neumaier()` now returns `±Infinity` (instead of `NaN`) when the input array contains `±Infinity`; fixes `lnL()`, `aic()`, and `bic()` silently returning `NaN` when any observation falls outside a distribution's support (#442).

## [1.25.0] - 2026-05-25

### Added

- `bench/` directory with `bench/index.js`: a performance comparison script benchmarking ranjs against jStat and `@stdlib/stats/base/dists` across Normal, Gamma, Beta, Poisson, and Exponential distributions for sample, pdf, cdf, and quantile operations. Run with `npm run bench`. Closes #114.
- TypeScript declarations are now generated from JSDoc via `tsc --allowJs --declaration --emitDeclarationOnly` as part of `npm run build`. The generated `dist/index.d.ts` replaces the hand-written `dist/ranjs.d.ts`, making type drift structurally impossible. Includes `@overload` annotations for `sample()`, `float()`, `int()`, `choice()`, `shuffle()`, and `coin()`. Closes #170.

- `DoublyNoncentralChi2` distribution: the law of `X = U + V` with `U ~ ncχ²(k1, λ1)` and `V ~ ncχ²(k2, λ2)` independent. Because the non-central chi-square is closed under addition, `DoublyNoncentralChi2(k1, k2, λ1, λ2)` is exactly `ncχ²(k1 + k2, λ1 + λ2)`; it is implemented in that collapsed closed form rather than via a double Poisson series. Closes #228.
- `Distribution._qEstimateWalk(p, start)` protected helper: deterministic linear walk from a caller-supplied integer start toward the infimum discrete quantile. Exits when `cdf(k) >= p` and `cdf(k-1) < p`. Provides a non-random alternative to `_qEstimateRoot` for infinite-support discrete distributions with analytically-known parameters. Closes #284.
- Property tests for all distributions: `cdfMonotonicity` now asserts `cdf(x₂) >= cdf(x₁)` across a deterministic grid (it was previously a no-op that only asserted scalar arithmetic ordering). A new `Tests.quantileRoundtrip` helper asserts `|cdf(q(p)) − p| < 1e-6` for continuous distributions and the two-sided infimum definition for discrete distributions across the fixed probability grid `{0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95}`. Closes #212.

- `R` distribution generator, PDF, and CDF now produce a symmetric distribution matching the documented formula `f(x; c) = (1 - x²)^(c/2-1) / B(1/2, c/2)` on `[-1, 1]`. The previous implementation configured `Beta(0.5, c/2)` (the squared-variable parent) but then applied the affine substitution `y = (x+1)/2` and squared it, breaking `x → −x` symmetry. For `c=4`, `pdf(-0.95)` returned `~0.7495` instead of the correct `~0.0731`. Reduced to the affine `U = (X+1)/2 ~ Beta(c/2, c/2)`, which is one-to-one and avoids the `0·∞` corner at `x=0` for `c<2`. `refVals` for `R(4)` (previously deferred) added to the test suite. Closes #261.
- `Soliton` distribution support truncation fixed: the weight array was built with `length: N-2`, silently omitting `k=N` and causing the Categorical base class to renormalize the remaining weights upward. Changed to `length: N-1` so `pmf(1)` returns the correct `1/N` and `pmf(N)` returns `1/(N(N-1))`. Closes #263.
- Catastrophic cancellation in `_cdf` near the lower support boundary fixed for 20 distributions: `FlorySchulz` (naive `1 − (1−a)^k·(1+ka)` rewritten with `expm1`/`log1p`, #248); `Moyal` (Q(½,z) now routed through `gammaUpperIncomplete` directly, #247); `Rice` and `NoncentralChi2` (complementary Marcum Q computed via new `marcumP` export instead of `1 - marcumQ`, #246, #245); `InverseGamma` and `InverseChi2` (upper tail via `gammaUpperIncomplete` directly, #244, #243); and 13 distributions using `Math.expm1`/`Math.log1p`/`Math.tanh` builtins: `Exponential`, `Benini`, `Gompertz`, `Hyperexponential`, `GeneralizedPareto`, `Lomax`, `Burr`, `Pareto`, `GammaGompertz`, `Makeham`, `GeneralizedExponential`, `HalfLogistic`, `LogisticExponential`, `Muth` (#214). The `checkRefVals` test helper now falls back to relative tolerance for sub-precision expected values. Boundary-region reference values added for all fixed distributions.
- scipy/numpy/R reference values (`refVals`) added to 55 distributions across all families, computed from scipy 1.17.1 / R and never transcribed from the ranjs source: 10 chi/t/F/gamma-family (#126), 9 normal and logistic variants (#127), 9 extreme-value and heavy-tail (#128), 12 miscellaneous continuous including `InverseGaussian`, `LogGamma`, `Skellam`, `FisherZ` (#130), 7 noncentral (#133), and 8 core discrete (#134). Three non-trivial scipy parameterization differences (Geometric indexing, NegativeBinomial success/failure swap, Hypergeometric name collision) are documented in `solutions/testing/2026-05-18-1443-discrete-refvals-scipy-parameterization-traps.md`.
- `eslint-plugin-jsdoc` added as a devDependency with a `jsdoclint` npm script and a new parallel CI job. Enforces JSDoc presence on public `Distribution` methods and exported namespace functions; catches stale `@param`/`@returns` after signature changes. Fixes `@return` → `@returns` in 12 files and adds JSDoc to two previously undocumented internal helpers. Closes #202.
- Docs site now includes a [scipy.stats → ranjs porting guide](docs/templates/porting-scipy.pug) (`porting-scipy.html`) with side-by-side Python/JavaScript examples for the 20 most-used scipy distributions, a method-mapping table, and callouts for non-trivial parameter differences (LogNormal, Weibull, Triangular, Geometric, Hypergeometric).
- Per-distribution subpath exports: `import Normal from 'ranjs/dist/normal'` now resolves correctly in Node.js ESM, browsers, and bundlers (Vite, Webpack, esbuild). Each of the 134 exported distributions has a corresponding self-contained ESM bundle at `dist/<name>.esm.js` (≈8–15× smaller than importing the full library). See [ADR-0005](decisions/0005-per-distribution-subpath-exports.md).
- Automated npm publish workflow (`.github/workflows/release.yml`): pushing a `v*` tag now runs lint, typecheck, and tests before publishing to npm with provenance attestation. Requires an `NPM_TOKEN` secret in repository settings.
- TypeScript type declarations added (`dist/ranjs.d.ts`). All 135 distribution classes, the `Distribution` base class (17 public methods), and the `core`, `location`, `dispersion`, `shape`, `dependence`, and `test` namespaces are now fully typed. `"types": "./dist/ranjs.d.ts"` added to `package.json` at the top level and inside `"exports"` for full compatibility with all TypeScript `moduleResolution` modes. See [ADR-0003](decisions/0003-typescript-declarations.md).
- Build now produces three artifacts: `dist/ranjs.esm.js` (ES module), `dist/ranjs.cjs.js` (CommonJS), and `dist/ranjs.min.js` (UMD, minified, CDN). `"exports"` field added to `package.json` routing `import` to ESM and `require` to CJS. `"sideEffects": false` added to enable tree-shaking across the 130+ distribution classes.

### Changed

- Distribution JSDoc references de-duplicated: removed 135 `@see <url>` tags
  whose URL was identical to the inline `{@link <url>}` already present in
  the distribution's description. The rendered "References" section now
  appears only when it carries non-trivial information (papers, books,
  algorithm citations) rather than repeating the distribution-name link.
  Four `// Source:` code comments (Alpha, Anglit, Arcsine, BaldingNichols)
  were promoted to class-level `@see` entries so the cited works show up in
  the rendered docs.

- `Gamma.q(p)` (and `Chi2.q(p)`, `InverseGamma.q(p)`) Wilson-Hilferty seed now uses
  an A&S §26.2.17 rational approximation instead of `erfinv`, eliminating nested
  Newton iteration inside the outer Halley loop and accelerating quantile throughput.
  Closes #384.

- `Normal.q(p)` now uses an A&S §26.2.17 rational approximation seed with two fixed
  Newton refinement steps instead of `erfinv`, removing the convergent Newton loop
  and reducing from 3–5 `erf` evaluations to exactly 2. Closes #385.

- `StudentT.q(p)` now uses a 4-term Cornish-Fisher seed (A&S §26.7.8) + Halley
  refinement instead of the previous 2-term seed + Newton, reducing CDF evaluations
  from ~5 to ~2 and yielding ~2.4× additional throughput improvement. Closes #381.

- `StudentT.q(p)` now uses a Cornish-Fisher seed + Newton refinement instead of
  Brent root-finding, reducing CDF evaluations from ~20 to ~3 and yielding
  ~7× throughput improvement. Closes #368.

- Normal variate generator now uses the Improved Ziggurat algorithm
  (Marsaglia-Tsang 2000 / Doornik 2005) instead of Box-Muller, achieving
  2–4× throughput improvement on `Normal.sample()` and all distributions
  that derive normal variates (`Levy`, `NoncentralT`, `DoublyNoncentralT`,
  `InverseGaussian`, Gamma-family). Public API unchanged. Also eliminates
  a latent NaN when the PRNG returned exactly 0 (`log(0)` in Box-Muller).
  Closes #369.

- `Distribution` internal field `this.t` renamed to `this._type` for readability. No behavioural change. Closes #205 (PR 1/6).

- `marcumQ` and `marcumP` now evaluate the transition band `y ≈ x + μ` with `μ ≥ 135` via the large-μ uniform asymptotic expansion (Section 4.2 of Gil, Segura & Temme, arXiv:1311.0681) instead of the `O(μ)` three-term recurrence. This is the fifth and final computation branch of the source algorithm and removes the recurrence's accumulated rounding in that regime. Closes #315.

- `DoublyNoncentralChi2` now extends `NoncentralChi2` instead of reimplementing its PDF and CDF. The `_pdf`, `_cdf`, and `_generator` are fully inherited. The model complexity used by `aic()` and `bic()` changes from 4 to 2, reflecting that the distribution has 2 identifiable parameters in its collapsed form `NoncentralChi2(k1+k2, λ1+λ2)`. `NoncentralChi2` now also accepts `lambda = 0` (was `lambda > 0`), degenerating correctly to a central chi-squared. Closes #316.

- **BREAKING:** All 131 distribution constructors now require their parameters — default values have been removed. Constructing a distribution with no arguments (e.g. `new Normal()`, `new Exponential()`) now throws `Error('Invalid parameters. Required parameters missing or not a number: ...')` instead of silently using arbitrary defaults. The 7 distributions that genuinely have no parameters (`Gilbrat`, `HalfLogistic`, `HyperbolicSecant`, `Kolmogorov`, `Rademacher`, `Slash`, `UniformRatio`) still construct with no arguments. `Distribution.validate()` now rejects `undefined` and `NaN` parameter values as a centralized fail-fast guard. See [ADR-0004](decisions/0004-validate-rejects-undefined-and-nan.md) and #50.
- `docs/index.html` is no longer tracked in the repository; it is now built and deployed to GitHub Pages automatically via `actions/deploy-pages@v4` on every push to `main`. The `docs-build` CI job now uploads via `actions/upload-pages-artifact@v3` instead of `actions/upload-artifact@v4`.
- CI now runs `npm run build` on every push to `main` and every pull request; a build badge scoped to the `build` job was added to `README.md`.
- Replaced hand-rolled SVG pixel math in `.github/scripts/gen-badge.js` with `badge-maker`; removed legacy `.circleci/config.yml`.
- Upgraded `rollup` from `^2.64.0` to `^4.x`. Replaced unmaintained `rollup-plugin-terser` with `@rollup/plugin-terser`. Upgraded `@rollup/plugin-node-resolve` from `^13.x` to `^16.x`.
- Docs build (`npm run docs`) is now driven by a `pages` array in `docs/index.js`; adding a page is one array entry plus one Pug template that extends the new shared layout `docs/templates/_layout.pug`. The compiled SCSS is written once to `docs/styles/style.css` and linked externally from every page (previously inlined into each rendered HTML). See [ADR-0002](decisions/0002-docs-pages-array.md).
- Removed dead `coveralls` devDependency and its `coveralls` npm script (was never wired into CI).
- Removed `npm` from devDependencies (unconventional; runner's npm is used directly).
- Upgraded `nodemon` from `^2.0.15` to `^3.0.0` to fix a `semver` ReDoS vulnerability in `simple-update-notifier`.
- Fixed 24 of 41 `npm audit` vulnerabilities via `npm audit fix`.

### Deprecated

- `ran.dist.Hoyt` is deprecated. It was implementing the Nakagami-m distribution under the wrong name; `ran.dist.Nakagami` is the canonical, correctly-named class. `new Hoyt(q, omega)` now emits a `console.warn` and delegates entirely to `Nakagami(q, omega)`. The parameter constraint changes from `0 < q ≤ 1` to `q ≥ 0.5` (the Nakagami-m domain); computed values are identical for all previously valid `q ∈ [0.5, 1]`. `Hoyt` will be removed in a future major release. Closes #226.

### Removed

- Hand-written `dist/ranjs.d.ts` removed from version control (now a build artifact).
- `scripts/check-declarations.js` deleted (structural completeness now guaranteed by tsc).

- `Distribution` base class now exposes `bounded()`, returning `'bounded'`, `'lower'`, `'upper'`, or `'unbounded'` based on whether the support endpoints are finite. `type()` and `support()` are documented as stable public API. TypeScript declarations updated accordingly. Closes #119.

- `GeneralizedPareto`, `ShiftedLogLogistic`, and `TukeyLambda` GoF sampling tests now cover the boundary branches (`xi=0` / `lambda=0`) in `_q`, exercising the `−log(1−p)`, logistic, and `log(p/(1−p))` code paths respectively. Closes #270.

### Fixed

- Docs build now locates the `ran` module entry in `documentation`'s output by
  `kind`/`name` instead of `root[0]`, restoring the API documentation section,
  sidebar menu, and search list on `docs/index.html`.

- `Gamma.q(p)` now uses a dedicated Wilson-Hilferty initial estimate + Halley refinement algorithm instead of the generic Brent root-finder, eliminating the 2.5–3× quantile overhead. `Chi2.q(p)` and `InverseGamma.q(p)` benefit automatically. `gammaLowerIncompleteInv` is now exported from `ran.special`. Closes #367.
- Quantile throughput restored for 10 derived distributions (`BirnbaumSaunders`, `DoubleWeibull`, `ExponentiatedWeibull`, `JohnsonSB`, `JohnsonSU`, `LogCauchy`, `LogLaplace`, `LogNormal`, `LogitNormal`, `TruncatedNormal`): `super._q` calls replaced with inlined closed-form formulas, eliminating the V8 megamorphic deoptimization that caused up to 56× slowdown. Closes #366.
- `HeadsMinusTails` now rejects `n = 0`: constraint tightened from `n >= 0` to `n > 0`, matching the documented domain $n \in \mathbb{N}^+$. Closes #363.
- `InverseGamma`: removed unused `this.c.betaAlpha` pre-computation (`Math.pow(beta, alpha)`) that was computed on every construction but never read. Closes #373.
- `docs/porting-scipy.html` styling now matches the API page: `h2` section headings, standalone table layout, side-by-side `.code-pair` code blocks (two columns ≥ 800 px, stacked on mobile), `.callout` warning blocks, and sidebar parity for the static (non-checkbox) jump menu. Closes #209.

- `NegativeBinomial` `_pdf(0)` returned `NaN` at `p=0` (`0 * -Infinity`), and `_generator()` returned `undefined` at `p=1` (`Poisson(Infinity)`). Added degenerate-case guards in `_pdf`, `_cdf`, and `_generator` for `p=0` (all mass at k=0), and tightened the parameter constraint from `p ≤ 1` to `p < 1` (p=1 yields an all-zero PMF and no valid distribution). Closes #145.

- `Champernowne` distribution was a non-functional stub: `_generator()` returned `undefined`, `_cdf(x)` always returned `1`, and `_pdf(x)` lacked its normalization constant. Fixed all three: normalization constant is now `alpha * sqrt(1 - lambda²) / (2 * arccos(lambda))`, CDF uses the closed-form `arctan(k * tanh(...))` formula, and `_generator()` uses inverse-transform sampling via a new closed-form `_q(p)`. The class is now exported from `src/dist/index.js` and declared in `dist/ranjs.d.ts`. Closes #337.

- `BenktanderII` near-boundary `refVals` at `x = 1+1e-6` and `x = 1+1e-4` (params `[2, 0.9995]`) were replaced with values derived independently via Python `Decimal` at 60 decimal places using the direct mathematical formula, not the `expm1`-based implementation formula. Closes #295.

- `romberg` returned the silent sentinel `0` when the 20-step budget was exhausted without convergence — indistinguishable from a genuine zero integral. It now returns the best Richardson extrapolate accumulated so far, consistent with how `trap` returns its last estimate on timeout. The stray `console.log` in `Davis._cdf` (which exposed this bug during development) has also been removed. Closes #312.
- `marcumQ` and `marcumP` were accurate only for `x < 30` — the asymptotic, recurrence and quadrature computation branches existed only as commented-out scaffolding. Activated all four methods of Gil, Segura & Temme (arXiv:1311.0681) behind a regime dispatcher: series expansion (§3), large-ξ asymptotic expansion (§4.1), three-term recurrence relation (Eq. 14) and trapezoidal quadrature (§5). The Marcum functions are now accurate across the full `μ ≥ 1, x > 0, y > 0` domain, restoring full-range CDF precision for the `Rice`, `NoncentralChi2`, `DoublyNoncentralChi2` and `Skellam` distributions. Closes #253.

- `neumaier` sorted its input array in place, silently reordering the caller's array as a side effect. It now sorts a shallow copy, leaving the original array untouched. Closes #313.
- `DoublyNoncentralBeta._pdf` and `._cdf` returned `NaN` when `lambda1` or `lambda2` was 0, because the outward-summation Poisson-weight initialisation evaluated `0 * Math.log(0) = NaN` (IEEE 754). Added early-return guards: when `lambda1 = 0` the double sum collapses to `NoncentralBeta(beta, alpha, lambda2)` at `(1-x)`; when `lambda2 = 0` it collapses to `NoncentralBeta(alpha, beta, lambda1)` at `x`. `DoublyNoncentralF` (which inherits both methods) is fixed implicitly. Closes #304.

- `NoncentralBeta._pdf` and `._cdf` returned `NaN` for `lambda = 0` because the Poisson weight computation evaluated `0 * Math.log(0) = NaN` (IEEE 754). Added a guard: when `lambda / 2 === 0`, the weight for the sole k=0 term is 1. Closes #267.

- `besselI(n=1, x)` had only ~8 significant digits of accuracy due to a polynomial approximation (`_I1`, from Numerical Recipes) with limited-precision coefficients. Replaced with Miller's backward recurrence — the same algorithm used for n≥2 — and extended the loop upper-bound by `⌈2|x|⌉` to ensure the recurrence contracts the K_n component before reaching n=1 (required when |x| > n). Added odd-function sign correction for negative arguments. Fixes ~3.7e-10 CDF error in `VonMises` at intermediate x; expands VonMises refVals from 3 to 11 reference points. Closes #255.

- `BenktanderII._cdf` lost precision near the lower support boundary (x ≈ 1) due to catastrophic cancellation in `1 − exp(arg)` and `1 − xᵇ⁻¹·exp(u)` when their arguments approach zero. Rewrote using `Math.expm1` for the b=1 branch and a split `(1−xᵇ⁻¹) − xᵇ⁻¹·expm1(u)` decomposition for the general branch, eliminating the cancellation. Closes #242.
- `Bernoulli._q` returned `0` for all `p > 0.5` because `this.p.p` is `undefined` after the `Categorical` parent constructor overwrites `this.p` with `{ n, weights, min }`. Fixed by using `this.p.weights[0]` (the CDF at k=0) as the threshold. Closes #212.
- `DiscreteUniform._q`, `Geometric._q`, and `DiscreteWeibull._q` returned a quantile one too large when `p` landed exactly on a CDF step (e.g., `Geometric(0.5).q(0.5)` returned `1` instead of `0`). Each used `Math.floor` on the algebraic inverse `k+1`; changed to `Math.ceil(…) - 1` which is identical for non-integer arguments but correct at exact integers. Closes #212.
- `Skellam._q` applied `Math.floor` to the result of `_qEstimateRoot`, which finds a continuous root of `CDF(x) − p`. For a step function the root lands just below the integer boundary, causing `Math.floor` to undershoot by 1. Added a one-step correction: `if (this.cdf(k) < p) k++`. Closes #212.
- `Skellam._q` could silently return `NaN` in the extreme tails: `_qEstimateRoot` uses a random bracket initialisation and returns `undefined` when its 100-iteration cap is exhausted, and `Math.floor(undefined)` is `NaN`. Replaced with `_qEstimateWalk(p, Math.floor(μ₁ − μ₂))`, anchored at the distribution mean; the walk is fully deterministic and always returns a valid integer. Closes #283.

- `NoncentralBeta._pdf(0)` and `._cdf(0)` now return `0` instead of `NaN` at the closed-support lower boundary. The series in `recursiveSum` hits a 0/0 indeterminate form at exact `x = 0`, but the mathematical limit is `0` for `alpha > 1`. Added boundary guard and `{ x: 0, pdf: 0, cdf: 0 }` to `NoncentralBeta` refVals. Closes #230.
- `DoublyNoncentralT._pdf(0)` returned `NaN` when `mu !== 0`. Added an `x === 0` guard analogous to the one already present in `NoncentralT._pdf`; the j=0-only closed form `exp(c[0]) · Γ((ν+1)/2) · ₁F₁((ν+1)/2, ν/2; θ/2)` is now returned directly. Closes #229.
- `FisherZ` constructor now passes `(d1, d2)` to the F base class instead of `(d1/2, d2/2)`. Previously, `new FisherZ(d1, d2)` silently produced Fisher's z with degrees of freedom `(round(d1/2), round(d2/2))` (e.g. `FisherZ(5, 5)` was internally F(3, 3)). Internal-consistency tests passed because all distributional self-checks used the same wrong d.o.f. The bug was surfaced by adding scipy-independent reference values per #130. Closes #130.
- `MaxwellBoltzmann` constructor now passes rate = 1/(2a²) to the Gamma base class (was incorrectly 2a²). The distribution was previously self-consistent but produced values from the wrong density; the correct PDF is f(x;a) = sqrt(2/π) x² exp(−x²/2a²) / a³. Closes #126.
- `erf` and `erfc` in `src/special/error.js` now use a hybrid Taylor series (|x| ≤ 2) / Laplace continued fraction (|x| > 2) instead of delegating to `gammaLowerIncomplete`/`gammaUpperIncomplete`. This fixes relative precision loss in the tails (5σ+) and resolves the `// TODO Replace with continued fraction` comments. Adds far-tail `Normal(0, 2)` reference values at x = ±10 and ±14 to the test suite. Closes #211.

- `npm test` now works on Node 20+ by replacing the unmaintained `esm` loader with `@babel/register`, aligning the test and coverage execution paths.
- `Kolmogorov.pdf(0)` and `Kolmogorov.cdf(0)` now correctly return 0. Previously the lower support bound was declared `closed: true` (contradicting the documented support x > 0), causing `cdf(0)` to evaluate a non-convergent Grandi's series and return −1.
- `FisherZ.pdf(x)` no longer returns `Infinity` for right-tail values at default parameters (`d1=1, d2=1`). Replaced delegating computation through F→Beta with a direct log-space formula that avoids float64 precision loss when the Beta argument rounds to 1.0.
- `NegativeBinomial` constructor now correctly rejects out-of-range parameters: `r ≤ 0`, `p < 0`, and `p > 1`. Previously some values slipped through validation.
- Gamma sampler now runs Marsaglia-Tsang directly at shape `α = 1` instead of routing through the `Gamma(α+1) · U^(1/α)` boost branch. The boost is mathematically exact but consumes an extra PRNG draw per sample, which pushed the seed-42 KS statistic just over the p=0.01 critical value at N=10000. Fix transitively repairs sampling-test failures for `Gamma`, `Chi`, `Chi2`, `Erlang`, `InverseGamma`, `LogGamma`, `Nakagami`, and `GeneralizedGamma` at their default parameters (#193).
- `SkewNormal` sampler now draws both Box-Muller outputs from a single uniform pair instead of calling `_normal` twice (which discarded one branch per call). Halves PRNG consumption per sample and resolves the seed-12345 KS failure for the positive-shape-parameter case (#195).
- `NoncentralF.pdf(0)` and `NoncentralF.cdf(0)` now correctly return 0. Previously the delegating computation through `NoncentralBeta` produced NaN at the closed-support boundary x = 0 (`NoncentralBeta.{pdf,cdf}(0)` returns NaN; tracked separately as #230). Added closed-form guard in `_pdf`/`_cdf`. This also eliminates a flaky quantile-test failure where `_qEstimateRoot`'s bracket-search probed `cdf(0)` during expansion and propagated the NaN through Brent's method (#233).

### Accepted risks (pending follow-up issues)

- `mathjax-node-page` ≥1.4.1 and its transitive chain (`form-data`, `mathjax`, `qs`, `tough-cookie`, `yargs-parser`) retain known vulnerabilities. The fix requires downgrading to `mathjax-node-page@2.0.0` (breaking change). These are docs-only tools with no impact on library users; issue #116 will replace this toolchain.
- `serialize-javascript` ≤7.0.4 remains in `mocha` and `rollup-plugin-terser`. The `mocha` fix requires a major upgrade (tracked in #99); the `rollup-plugin-terser` fix is a downgrade and tracked under #107.
- `vue-template-compiler` ≥2.0.0 remains in `documentation`. The fix would downgrade to `documentation@6.2.0`; issue #116 will replace this tool.
