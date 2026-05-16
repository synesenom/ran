# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Automated npm publish workflow (`.github/workflows/release.yml`): pushing a `v*` tag now runs lint, typecheck, and tests before publishing to npm with provenance attestation. Requires an `NPM_TOKEN` secret in repository settings.
- TypeScript type declarations added (`dist/ranjs.d.ts`). All 135 distribution classes, the `Distribution` base class (17 public methods), and the `core`, `location`, `dispersion`, `shape`, `dependence`, and `test` namespaces are now fully typed. `"types": "./dist/ranjs.d.ts"` added to `package.json` at the top level and inside `"exports"` for full compatibility with all TypeScript `moduleResolution` modes. See [ADR-0003](decisions/0003-typescript-declarations.md).
- Build now produces three artifacts: `dist/ranjs.esm.js` (ES module), `dist/ranjs.cjs.js` (CommonJS), and `dist/ranjs.min.js` (UMD, minified, CDN). `"exports"` field added to `package.json` routing `import` to ESM and `require` to CJS. `"sideEffects": false` added to enable tree-shaking across the 130+ distribution classes.

### Changed

- `docs/index.html` is no longer tracked in the repository; it is now built and deployed to GitHub Pages automatically via `actions/deploy-pages@v4` on every push to `main`. The `docs-build` CI job now uploads via `actions/upload-pages-artifact@v3` instead of `actions/upload-artifact@v4`.
- CI now runs `npm run build` on every push to `main` and every pull request; a build badge scoped to the `build` job was added to `README.md`.
- Replaced hand-rolled SVG pixel math in `.github/scripts/gen-badge.js` with `badge-maker`; removed legacy `.circleci/config.yml`.
- Upgraded `rollup` from `^2.64.0` to `^4.x`. Replaced unmaintained `rollup-plugin-terser` with `@rollup/plugin-terser`. Upgraded `@rollup/plugin-node-resolve` from `^13.x` to `^16.x`.
- Docs build (`npm run docs`) is now driven by a `pages` array in `docs/index.js`; adding a page is one array entry plus one Pug template that extends the new shared layout `docs/templates/_layout.pug`. The compiled SCSS is written once to `docs/styles/style.css` and linked externally from every page (previously inlined into each rendered HTML). See [ADR-0002](decisions/0002-docs-pages-array.md).

### Fixed

- `npm test` now works on Node 20+ by replacing the unmaintained `esm` loader with `@babel/register`, aligning the test and coverage execution paths.
- `Kolmogorov.pdf(0)` and `Kolmogorov.cdf(0)` now correctly return 0. Previously the lower support bound was declared `closed: true` (contradicting the documented support x > 0), causing `cdf(0)` to evaluate a non-convergent Grandi's series and return −1.
- `FisherZ.pdf(x)` no longer returns `Infinity` for right-tail values at default parameters (`d1=1, d2=1`). Replaced delegating computation through F→Beta with a direct log-space formula that avoids float64 precision loss when the Beta argument rounds to 1.0.
- `NegativeBinomial` constructor now correctly rejects out-of-range parameters: `r ≤ 0`, `p < 0`, and `p > 1`. Previously some values slipped through validation.
- Gamma sampler now runs Marsaglia-Tsang directly at shape `α = 1` instead of routing through the `Gamma(α+1) · U^(1/α)` boost branch. The boost is mathematically exact but consumes an extra PRNG draw per sample, which pushed the seed-42 KS statistic just over the p=0.01 critical value at N=10000. Fix transitively repairs sampling-test failures for `Gamma`, `Chi`, `Chi2`, `Erlang`, `InverseGamma`, `LogGamma`, `Nakagami`, and `GeneralizedGamma` at their default parameters (#193).
- `SkewNormal` sampler now draws both Box-Muller outputs from a single uniform pair instead of calling `_normal` twice (which discarded one branch per call). Halves PRNG consumption per sample and resolves the seed-12345 KS failure for the positive-shape-parameter case (#195).

## [1.24.6] - 2026-05-14

### Changed

- Removed dead `coveralls` devDependency and its `coveralls` npm script (was never wired into CI).
- Removed `npm` from devDependencies (unconventional; runner's npm is used directly).
- Upgraded `nodemon` from `^2.0.15` to `^3.0.0` to fix a `semver` ReDoS vulnerability in `simple-update-notifier`.
- Fixed 24 of 41 `npm audit` vulnerabilities via `npm audit fix`.

### Accepted risks (pending follow-up issues)

- `mathjax-node-page` ≥1.4.1 and its transitive chain (`form-data`, `mathjax`, `qs`, `tough-cookie`, `yargs-parser`) retain known vulnerabilities. The fix requires downgrading to `mathjax-node-page@2.0.0` (breaking change). These are docs-only tools with no impact on library users; issue #116 will replace this toolchain.
- `serialize-javascript` ≤7.0.4 remains in `mocha` and `rollup-plugin-terser`. The `mocha` fix requires a major upgrade (tracked in #99); the `rollup-plugin-terser` fix is a downgrade and tracked under #107.
- `vue-template-compiler` ≥2.0.0 remains in `documentation`. The fix would downgrade to `documentation@6.2.0`; issue #116 will replace this tool.

