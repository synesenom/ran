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

# Run tests (Mocha)
npm test

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
- `src/dist/_distribution.js` — Abstract `Distribution` base class. New distributions subclass this and call `super(type, k)` where `type` is `'continuous'` or `'discrete'` and `k` is the parameter count. The constructor sets `this.p` (parameters), `this.s` (support bounds as `[{closed, value}, ...]`), `this.c` (pre-computed speed-up constants — **must be a named object `{ name: value, ... }`, never a positional array**), and `this.r` (PRNG). Distributions must implement `_pdf(x)` (or `_pmf(x)` for discrete) and `_cdf(x)`. The base class derives `sample()`, `pdf()`, `cdf()`, `quantile()`, `hazard()`, `cHazard()`, `survival()`, `likelihood()`, `aic()`, `bic()`, and `test()` from those two methods. Parameters are validated via `static validate(params, constraints)` in the constructor.
- `src/algorithms/` — Numerical algorithms: Romberg integration (`romberg.js`), Brent root-finding (`brent.js`), Newton's method (`newton.js`), bracket search (`bracket.js`), rejection sampling (`rejection.js`), Neumaier compensated summation (`neumaier.js`), accelerated summation (`accelerated-sum.js`), recursive summation (`recursive-sum.js`), quickselect (`quickselect.js`).
- `src/special/` — Special mathematical functions: gamma, log-gamma, incomplete gamma/beta, beta, log-beta, Bessel functions, error function, digamma, hypergeometric, Hurwitz zeta, Riemann zeta, Lambert W, Marcum Q, Owen T, Stirling numbers.
- `src/core/` — PRNG (`xoshiro.js` — xoshiro128+), mathematical constants, seeding utilities. Exports `float` (uniform `[0,1)`), `int`, and `bool` generators.
- `src/la/` — Linear algebra: `matrix.js` and `vector.js`.
- `src/mc/` — Markov Chain Monte Carlo: `mcmc.js` (base), `rwm.js` (random walk Metropolis), `slice.js` (slice sampling), `mcmc2.js`, `gelman-rubin.js` (convergence diagnostic).
- `src/location/`, `src/dispersion/`, `src/shape/`, `src/dependence/` — Statistical summary measures (mean, median, variance, skewness, Pearson, Spearman, Kendall, etc.).
- `src/test/` — Statistical hypothesis tests (Bartlett, Levene, Brown-Forsythe, Mann-Whitney, HSIC).
- `src/ts/` — Time series: online covariance.

**Module pattern:** Each namespace has an `index.js` that re-exports named functions from sibling files. Distribution index exports all constructors by PascalCase name. Private helpers are prefixed with `_` (e.g. `_gamma.js`, `_normal.js`).

**Distribution naming:** File names are kebab-case (`log-normal.js`); exported class names are PascalCase (`LogNormal`). Pre-computed table distributions extend `PreComputed` from `_pre-computed.js`.

## Testing Conventions

- Tests live in `test/` and mirror `src/` module structure.
- Mocha test runner with Chai `assert` for assertions.
- `test/test-utils.js` — shared helpers: `ksTest`, `chiTest`, `repeat`, `Tests`.
- `test/dist-cases-continuous.js` and `test/dist-cases-discrete.js` — per-distribution test case definitions (`name`, `invalidParams`, `params`, `cases`), split by distribution type.
- `test/dist.js` — runs the full distribution test suite against all entries in `dist-cases-continuous.js` and `dist-cases-discrete.js`.
- **Behavior-first assertions**: assert on the output of public methods given known inputs (hand-calculated expected values), not on internal state.
- **Statistical verification**: use `ksTest` (Kolmogorov-Smirnov) for continuous distributions and `chiTest` (chi-squared) for discrete distributions when verifying that `sample()` produces correctly distributed values.
- **New distributions must be added to the appropriate `test/dist-cases-*.js` file** with `invalidParams`, `params`, and `cases` entries before any implementation is written (TDD).
- **No 100% line coverage enforcement** — test for meaningful behavior, not line counts.

## GitHub Issues

- **Always use the `ops-issue` agent** when creating GitHub issues. Never call `gh issue create` directly.
- Every issue must have a **priority** label (`high`, `medium`, `low`) and a **difficulty** label (`difficult`, `moderate`, `trivial`).
- Breaking-change issues also get a **`major`** label. Breaking means: constructor or public-method rename/removal, or intentional parameter convention changes. Bug fixes — including wrong-formula corrections — are not major even if they change computed values; document them in the changelog instead. Everything else gets no semver label.
- Every issue must be assigned to a **milestone**: `v2.0.0` for `major` issues, `v1.25.0` for everything else. The `ops-issue` agent sets this automatically. A GitHub Actions workflow (`.github/workflows/require-milestone.yml`) flags any issue opened without a milestone.
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

**Semver tiers:**
- **Patch** (`x.y.Z`): dependency updates, bug fixes, internal refactors with no API change.
- **Minor** (`x.Y.0`): new distributions, new public methods, additive API changes.
- **Major** (`X.0.0`): breaking API changes (parameter renames, removed methods, changed return shapes).

**Per-PR changelog rule:** If a PR makes a user-visible change (bug fix, new feature, dependency security fix, removed dead code), add a bullet to the `## [Unreleased]` section of `CHANGELOG.md` following the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format. Pure refactors, test-only changes, and doc-only changes do not need a changelog entry.

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

`dist/ranjs.d.ts` is a **hand-written** ambient module declaration (not generated). It is exempted from the `/dist/` gitignore rule via `!dist/ranjs.d.ts`.

**Maintenance rules:**
- When adding a new distribution class, add a corresponding `class <Name> extends Distribution { constructor(...) }` line to `dist/ranjs.d.ts` in alphabetical order.
- When adding a new public method to the `Distribution` base class, add the matching signature to the `class Distribution { ... }` block.
- When adding a function to a statistical namespace (`core`, `location`, `dispersion`, `shape`, `dependence`, `test`), add its typed signature in the matching `export namespace` block.
- Run `npm run typecheck` after every edit to `dist/ranjs.d.ts` to confirm the file compiles correctly.
- `tsconfig.json` is for typecheck only (`"noEmit": true`) and resolves `ranjs` imports via `paths` pointing at `dist/ranjs.d.ts`.

## Communication Style

- **Be brutally honest.** Never sugarcoat answers, even if the truth is uncomfortable. If an idea is bad, say so directly and explain why. If a formula is wrong, say it is wrong.
- **Back opinions with evidence.** Cite numerical analysis principles, statistical references, or established mathematical results when pushing back. "This formula produces biased estimates because..." is better than "this might not be ideal."
- **Reject bad ideas explicitly.** Do not find ways to make a bad idea work just to be agreeable. Say "this is the wrong approach because..." and propose what to do instead.

## Workflow

- When editing multiple files, make all independent edits in parallel.
- When performing multi-step tasks, show a progress list with checkboxes (e.g., `- [x]` done, `- [ ]` pending) and update it as you go.
- **Always use selectable options** (via the `AskUserQuestion` tool) when asking the user to make a choice or design decision during planning or implementation. Never ask the user to type their choice as free text. Always include a final option labeled "Other" or "Type something" so the user can provide a custom answer if none of the options fit.
- **Never stop mid-pipeline.** When a sub-skill (`/commit`, `/push`, `/pull-request`, etc.) is invoked from within a parent skill (`/hotfix`, `/build`, `/implement`, etc.), continue executing the parent workflow immediately after the sub-skill returns. Do not pause for user input between steps unless the parent skill explicitly requires it. Do not output text that implies completion (e.g. "Done!", "Committed!") between steps — save all status reporting for the parent skill's final report.

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
- **PR gate:** Non-trivial PRs must reference at least one ADR. The `/pull-request` skill enforces this.
- **Location:** `decisions/` at the repo root.
