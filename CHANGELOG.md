# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `npm test` now works on Node 20+ by replacing the unmaintained `esm` loader with `@babel/register`, aligning the test and coverage execution paths.

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

