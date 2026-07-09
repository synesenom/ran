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

## Code Health MCP server (CodeScene)

The project ships a CodeScene Code Health MCP server, configured in `.mcp.json` and enabled in `.claude/settings.json`. It runs the same way in every environment (local laptop and Claude Code cloud):

- **Binary** — `@codescene/codehealth-mcp` is a pinned `devDependency`, so `npm install` places it in `node_modules/.bin` and `.mcp.json` launches it with `npx`. No global install, nothing machine-specific. It works out of the box on any machine that has run `npm install`.
- **Token** — the server authenticates with a personal access token read from the `CS_ACCESS_TOKEN` environment variable. This is a per-user secret and is **never committed**. On a new machine:
  1. Create a PAT at <https://codescene.io/users/me/pat>.
  2. Export it in your shell profile so `claude` (and its MCP subprocess) inherit it:
     ```bash
     echo 'export CS_ACCESS_TOKEN=pat_...' >> ~/.zshrc && source ~/.zshrc
     ```

The `SessionStart` hook (`.claude/hooks/session-start.sh`) prints a warning if `CS_ACCESS_TOKEN` is unset, so a missing token is self-diagnosing. In the Claude Code cloud environment the token is provisioned as an environment variable instead.

## Adding a new distribution

1. **Write test cases first** (TDD). Add an entry to `test/dist-cases-continuous.js` (or `test/dist-cases-discrete.js` for discrete distributions) with `invalidParams`, `params`, and at least one `cases` entry before touching `src/`.
2. Create `src/dist/<kebab-case-name>.js`. Subclass `Distribution` from `src/dist/_distribution.js` and implement `_pdf(x)` / `_pmf(x)` and `_cdf(x)`. Call `super('continuous' | 'discrete', <param-count>)`.
3. Re-export the class from `src/dist/index.js`.
4. TypeScript declarations are **generated** from JSDoc — do not edit `dist/ranjs.d.ts` by hand. Give the class an explicit name (`export default class MyDist extends Distribution`) and add `@param` tags to the `constructor()` JSDoc block. Run `npm run build && npm run typecheck` to verify the generated declarations.
5. Run `npm run standard && npm test && npm run typecheck`.

See `CLAUDE.md` for the full distribution pattern, parameter conventions, and JSDoc format.

## PR conventions

- **Production-code diff under ~400 lines** (tests excluded). If a feature cannot fit, decompose it into smaller issues first.
- **One concern per PR.** Avoid titles that contain `+`, "and", or comma-separated lists.
- **Commit messages**: short imperative subject line (`Add Gompertz distribution`), body for context if needed.
- **Changelog**: if your change is user-visible (new feature, bug fix, dependency update), add a bullet under `## [Unreleased]` in `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format. Pure refactors, test-only, and doc-only changes do not need an entry.
- **No force-pushing** to a PR branch once review has started.

## Code conventions

- **Comments explain *why*, not *what*.** The code already says what it does; a comment must add information the reader cannot get from the identifiers alone (a hidden constraint, a workaround, a non-obvious invariant). Never describe the operation the next line performs.
- **Error and missing-value returns** follow a strict hierarchy. `throw` for caller/programming errors (invalid parameters, wrong arity). `NaN` for valid inputs that have no defined answer (e.g. mean of a Cauchy). `Infinity`/`-Infinity` for values that diverge. `0` when the mathematically correct answer is zero. Never return `undefined` as a sentinel for "no result".
- **Distribution constants** must be a named object: `this.c = { name: value, ... }`. Never use a positional array (`this.c = [a, b]`) — named fields are required so constants remain readable after minification.
- **Subclass constants**: if a parent class already initialises `this.c`, extend it with `Object.assign(this.c, { newKey: value })`. Assigning `this.c = { ... }` in a subclass silently destroys the parent's constants.

## Running a subset of tests

```bash
./node_modules/.bin/_mocha --require @babel/register test/dist.js   # distribution suite only
./node_modules/.bin/_mocha --require @babel/register test/<file>.js # any single file
```

## Getting help

Open an issue with the **question** label or start a GitHub Discussion.
