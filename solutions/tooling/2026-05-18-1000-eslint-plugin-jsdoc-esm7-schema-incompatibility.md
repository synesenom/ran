---
date: 2026-05-18T10:00:00Z
category: "tooling"
problem: "eslint-plugin-jsdoc@62.x schema incompatibility with ESLint 7 legacy config; no CI enforcement of JSDoc on public API"
status: complete
related_issue: "#202"
related_plan: "thoughts/plans/2026-05-18-0910-jsdoc-enforcement.md"
tags: [eslint, jsdoc, eslint-plugin-jsdoc, ci, linting, public-api, ast-selectors]
---

# Solution: eslint-plugin-jsdoc enforcement with ESLint 7

**Date**: 2026-05-18
**Category**: tooling
**Related Issue**: #202

## Problem

The ranjs codebase had a convention requiring JSDoc on all public `Distribution` methods and
namespace exports, but nothing enforced it. Missing or stale `@param`/`@returns` tags on public
API additions went undetected until a consumer read the source or documentation failed to generate.

Additionally, the naive approach of enabling `require-jsdoc` globally would flag ~30 internal
non-exported helpers (`discreteMode`, `nTies`, `trapezoid`, etc.), requiring either JSDoc on
private helpers or widespread `eslint-disable` annotations.

## Root Cause

Standard.js (the project's primary linter) bundles its own ESLint instance and ignores the
project-level `.eslintrc.js`, making that file editor-hint-only. There was no enforcement path
that ran in CI.

When trying to add `eslint-plugin-jsdoc@62.x`, a schema validation error appeared at startup:
ESLint 7's legacy config system injects extra properties when merging config defaults, but v62's
`require-jsdoc` rule schema declares `additionalProperties: false`, making the two incompatible.

## Fix

1. **Separate config file**: `.eslintrc.jsdoc.js` with `--no-eslintrc` isolation, invoked by a
   dedicated `jsdoclint` npm script. This prevents `.eslintrc.js` from cascading unrelated rules
   (e.g. `no-unused-vars`) into the JSDoc lint pass.

2. **Pin to `^50.8.0`**: v50 works cleanly with ESLint 7 and supports the same AST `contexts`
   selectors. v62's stricter JSON schema is the incompatibility source.

3. **AST `contexts` selectors** instead of the blanket `require` flags, to target only exported
   symbols:
   - `ExportDefaultDeclaration > FunctionDeclaration` — anonymous default exports
   - `ExportNamedDeclaration > FunctionDeclaration` — named exports
   - `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression` — arrow exports (`core.seed`)
   - `MethodDefinition:not([key.name=/^_/]):not([kind=constructor])` — public class methods, excluding `_`-prefixed privates

4. **`tagNamePreference: { method: 'method' }`** in `settings.jsdoc` to preserve existing `@method`
   tags used for documentation.js compatibility — without this, `check-tag-names` flags them as
   preferring `@function`.

5. **Remove redundant `@constructor`** tags: the plugin prefers `@class`; removing the duplicate
   (keeping `@class Distribution`) is cleaner than fighting the config.

## Prevention Strategy

When adding `eslint-plugin-jsdoc` to a project using ESLint 7's legacy config:
- Pin to `^50.x` — not `^62.x`. Check the major version before installing.
- Always use `--no-eslintrc` on dedicated lint scripts that use a separate config file.
- Set `tagNamePreference` entries for any custom tags already in the codebase (`@method`, `@ignore`,
  etc.) before doing the first dry run, or expect dozens of false-positive tag-name violations.
- Use `contexts` AST selectors (not the blanket `require: { FunctionDeclaration: true }` flag) to
  scope enforcement to exported symbols only — the blanket flag catches private helpers too.

## Related Solutions

No prior ESLint/JSDoc solutions in this codebase.

## Key Insight

`eslint-plugin-jsdoc@62.x` is incompatible with ESLint 7's legacy config system because its
`require-jsdoc` rule schema declares `additionalProperties: false` while ESLint 7 injects extra
properties during config merging — pin to `^50.8.0` for ESLint 7 projects, and use AST `contexts`
selectors to scope JSDoc enforcement to exported symbols only without polluting internal helpers.
