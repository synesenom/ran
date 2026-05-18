# ADR-0007: Stay on `ranjs`; do not rename the npm package

**Date**: 2026-05-18
**Status**: Accepted

## Context

Issue #227 asked us to measure adoption of the `ranjs` npm package and choose between:

- **Option A**: Stay on `ranjs`, bump major versions freely, no deprecation dance.
- **Option B**: Publish a new package at 0.1.0 under a more descriptive name; deprecate `ranjs`.

The decision matrix from the issue:

| Signal | Action |
|---|---|
| >100 weekly downloads, real dependents | Stay on `ranjs`, plan a 2.0 with deprecation notes |
| 10–100 weekly downloads, mixed signals | Stay on `ranjs`; pay the major-bump cost |
| <10 weekly downloads, no real dependents | Rename |

### Adoption data collected (2026-05-18)

**GitHub dependents** (`github.com/synesenom/ran/network/dependents`): **13 repositories**.

**GitHub code search — `from 'ranjs'`**: 14 distinct repositories (excluding `synesenom/ran`):

| Repository | Nature |
|---|---|
| `wervin/ciko` | Medical app (newborn weight reference tables) |
| `yy/backward-contact-tracing` | Epidemiology research (contact tracing sim) |
| `BAschl/twb5` | Real project |
| `kyteg/JSE` | Real project |
| `nnseva/solidity-research` | Real project |
| `abhiomkar/DefinitelyTyped` | Fork of DefinitelyTyped (noise) |
| `fakecoinbase/DefinitelyTypedslashDefinitelyTyped` | Fork of DefinitelyTyped (noise) |
| `snippergoals/DefinitelyTyped` | Fork of DefinitelyTyped (noise) |
| `sonnguyeninspirelife/custom-types` | Test/throwaway |
| `starwolf0320/TS-Definitely-Typed` | Test/throwaway |
| `foolhill1231/Test` | Test/throwaway |
| `KottonKandee843/Newest` | Test/throwaway |
| `KottonKandee843/new` | Test/throwaway |
| `Eyenajaaa/Eyenajaaa` | Test/throwaway |

**GitHub code search — `require('ranjs')`**: 3 repositories (`yy/backward-contact-tracing`, `yy/contact-tracing`, `BAschl/twb5`).

**DefinitelyTyped**: `DefinitelyTyped/DefinitelyTyped` contains `types/ranjs/index.d.ts`, `package.json`, `tsconfig.json`, and `ranjs-tests.ts`. This is maintained externally and means `@types/ranjs` is a live npm package that any TypeScript user of `ranjs` depends on.

**npm download stats**: Unavailable in this session (npm API and npm-stat are blocked by the sandbox network policy). A maintainer with unrestricted network access should verify via `https://npm-stat.com/charts.html?package=ranjs` before reversing this decision.

### Signal interpretation

The DefinitelyTyped presence is the decisive signal: a contributor outside the core team wrote and submitted full type definitions to the largest TypeScript type registry. That effort is not undertaken for a package with zero real users. Combined with 5+ real projects visible in code search and 13 GitHub dependents, the evidence places `ranjs` firmly in the **10–100 weekly downloads, mixed signals** bucket.

The "opaque name" argument is real but not decisive at this adoption level. The keywords `random`, `distributions`, `statistics`, `mcmc`, and `test` are already present in the `package.json` `keywords` field, which npm search indexes. A rename does not meaningfully improve discoverability beyond that.

## Decision

**Stay on `ranjs`.** Do not publish under a new package name.

Breaking changes continue to ship as major-version bumps (`1.x → 2.x → 3.x`). No formal deprecation dance is required for a package at this adoption scale. When a breaking change is ready, bump the major version, note the breaking change in `CHANGELOG.md`, and ship.

The "bump majors freely" posture means we do **not** maintain long-lived `1.x` maintenance branches once `2.x` is out. A single active major version at a time is the policy.

## Consequences

- **Easier**: No cross-package coordination, no migration docs, no `package.json` `"deprecated"` field wrangling. Breaking changes ship without ceremony.
- **Harder**: The opaque name remains. Discoverability stays dependent on keywords and search indexing rather than a descriptive package name. If adoption grows significantly (>100 real dependents), this decision may need revisiting.
- **Users affected**: The ~5–7 real external dependents absorb major-version bumps as they always have. No forced migration from a rename.
- **DefinitelyTyped**: `@types/ranjs` remains valid and does not need to be deprecated or redirected.
