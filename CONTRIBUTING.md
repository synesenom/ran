# Contributing to ranjs

Thank you for your interest in contributing! Below is everything you need to get started.

## Prerequisites

- **Node.js** 18 or later
- **npm** (bundled with Node)

## Setup

```bash
git clone https://github.com/synesenom/ran.git
cd ran
npm install
```

## Verifying your environment

```bash
npm run lint       # linter check (Standard.js — no semicolons, 2-space indent)
npm test           # Mocha test suite
npm run typecheck  # TypeScript declaration validation
```

All three must pass before you open a PR. (`npm run standard` is the auto-fixing variant of the linter — useful during development, but `npm run lint` is what CI enforces.)

## Adding a new distribution

1. **Write test cases first** (TDD). Add an entry to `test/dist-cases.js` with `invalidParams`, `params`, and at least one `cases` entry before touching `src/`.
2. Create `src/dist/<kebab-case-name>.js`. Subclass `Distribution` from `src/dist/_distribution.js` and implement `_pdf(x)` / `_pmf(x)` and `_cdf(x)`. Call `super('continuous' | 'discrete', <param-count>)`.
3. Re-export the class from `src/dist/index.js`.
4. Add a matching `class <Name> extends Distribution` entry to `dist/ranjs.d.ts` (alphabetical order).
5. Run `npm run standard && npm test && npm run typecheck`.

See `CLAUDE.md` for the full distribution pattern, parameter conventions, and JSDoc format.

## PR conventions

- **Production-code diff under ~400 lines** (tests excluded). If a feature cannot fit, decompose it into smaller issues first.
- **One concern per PR.** Avoid titles that contain `+`, "and", or comma-separated lists.
- **Commit messages**: short imperative subject line (`Add Gompertz distribution`), body for context if needed.
- **Changelog**: if your change is user-visible (new feature, bug fix, dependency update), add a bullet under `## [Unreleased]` in `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format. Pure refactors, test-only, and doc-only changes do not need an entry.
- **No force-pushing** to a PR branch once review has started.

## Running a subset of tests

```bash
./node_modules/.bin/_mocha --require @babel/register test/dist.js   # distribution suite only
./node_modules/.bin/_mocha --require @babel/register test/<file>.js # any single file
```

## Getting help

Open an issue with the **question** label or start a GitHub Discussion.
