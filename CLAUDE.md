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

# Run tests (Mocha + coverage thresholds). Runs in parallel (mocha `parallel: true`
# in .mocharc.yml); the dist suite is sharded across test/dist-cases-{0..3}.js,
# test/dist-fit.js and test/dist-fit-gate.js so the cores are kept busy.
npm test
# IMPORTANT: always run npm test directly — never pipe it through grep or other
# commands. The mocha output prints "N passing" even when nyc's coverage
# thresholds are breached; the failure is only visible in the exit code and the
# "ERROR: Coverage for X does not meet global threshold" lines that a grep pipe
# will swallow. Thresholds: branches 90%, lines 98%, functions 100%, statements 98%.

# Fast local iteration: same tests, parallel, but WITHOUT nyc instrumentation
# (~2x faster). Skips coverage, so it does NOT enforce the thresholds above —
# always run the full `npm test` before pushing.
npm run test:fast

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
- `src/mc/` — Markov Chain Monte Carlo: `mcmc.js` (base), `rwm.js` (random walk Metropolis), `slice.js` (slice sampling), `mcmc2.js`, `gelman-rubin.js` (convergence diagnostic).
- `src/location/`, `src/dispersion/`, `src/shape/`, `src/dependence/` — Statistical summary measures (mean, median, variance, skewness, Pearson, Spearman, Kendall, etc.).
- `src/test/` — Statistical hypothesis tests (Bartlett, Levene, Brown-Forsythe, Mann-Whitney, HSIC).
- `src/ts/` — Time series: online covariance.

**Module pattern:** Each namespace has an `index.js` that re-exports named functions from sibling files. Distribution index exports all constructors by PascalCase name. Private helpers are prefixed with `_` (e.g. `_gamma.js`, `_normal.js`).

**Distribution naming:** File names are kebab-case (`log-normal.js`); exported class names are PascalCase (`LogNormal`). Pre-computed table distributions extend `PreComputed` from `_pre-computed.js`.

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
- `test/_dist-harness.js` — shared driver for the per-distribution suite: the `UnitTests` object (constructor/seed/load-save/analytical/sample/test) and `runCase(tc)`. Not a spec file itself.
- `test/dist-cases-{0,1,2,3}.js` — four interleaved shards; each runs `runCase` over every 4th entry of `[...continuous, ...discrete]` so mocha `--parallel` can balance the sampling/GoF work across cores.
- `test/dist-fit.js` and `test/dist-fit-gate.js` — the heavy `.fit()` suites and the fit precision/robustness gate, split out as their own parallel jobs.
- `test/dist.js` — base-class `Distribution` unit tests plus special-cased distribution blocks (Degenerate, Kolmogorov, Lindley, Mielke, Davis, param-count regressions).
- **Behavior-first assertions**: assert on the output of public methods given known inputs (hand-calculated expected values), not on internal state.
- **Statistical verification**: use `ksTest` (Kolmogorov-Smirnov) for continuous distributions and `chiTest` (chi-squared) for discrete distributions when verifying that `sample()` produces correctly distributed values.
- **New distributions must be added to the appropriate `test/dist-cases-*.js` file** with `invalidParams`, `params`, and `cases` entries before any implementation is written (TDD).
- **No 100% line coverage enforcement** — test for meaningful behavior, not line counts.

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

## Workflow

- When editing multiple files, make all independent edits in parallel.
- When performing multi-step tasks, show a progress list with checkboxes (e.g., `- [x]` done, `- [ ]` pending) and update it as you go.
- **Always use selectable options** (via the `AskUserQuestion` tool) when asking the user to make a choice or design decision during planning or implementation. Never ask the user to type their choice as free text. Always include a final option labeled "Other" or "Type something" so the user can provide a custom answer if none of the options fit.
- **Never stop mid-pipeline.** When a sub-skill (`/commit`, `/push`, `/pr`, etc.) is invoked from within a parent skill (`/hotfix`, `/build`, `/implement`, etc.), continue executing the parent workflow immediately after the sub-skill returns. Do not pause for user input between steps unless the parent skill explicitly requires it. Do not output text that implies completion (e.g. "Done!", "Committed!") between steps — save all status reporting for the parent skill's final report.

## Code Style

- Standard.js formatting enforced via `npm run standard`. No semicolons, 2-space indentation.
- **WHY-only comments.** Inline comments must explain *why* code exists or *why* this approach was chosen — never *what* the code does. Code already says what; comments must say why. Good: `// Neumaier compensated sum avoids catastrophic cancellation for very large N`. Bad: `// sum the array`.
- JSDoc comments on public Distribution methods follow the existing format. Skip on simple utility functions where name + parameters are self-explanatory.
- Type hints are not used — plain JavaScript.

## Architecture Decision Records (ADRs)

ADRs capture significant design decisions and their rationale. They live in `decisions/` and follow the Nygard format.

- **When to write an ADR:** When a decision affects the public API of `Distribution` or another base class, the module export structure, conventions for how parameters/support/constants are stored, cross-cutting codebase conventions, or introduces/removes a dependency. Do **not** write an ADR for implementation-technique choices (e.g., which numerical approximation to use inside a single function, which root-finding algorithm to call) — those belong in a commit message or solution file.
- **Format:** Use the template at `decisions/0000-template.md`. One decision per file, numbered sequentially.
- **Status lifecycle:** Proposed → Accepted → (Superseded or Deprecated). Accepted ADRs are immutable — supersede, don't edit.
- **Who writes them:** The `/plan` skill produces ADRs automatically for non-trivial design decisions. For manual work, write the ADR before or alongside the implementation.
- **Inline references:** After writing an ADR, add a reference at the most relevant code location — a WHY comment at the affected class/function. Use the relative path format: `decisions/NNNN-slug.md — one-line rationale`.
- **PR gate:** Non-trivial PRs must reference at least one ADR. The `/pr` skill enforces this.
- **Location:** `decisions/` at the repo root.
