# ADR-0006: JSDoc Enforcement via eslint-plugin-jsdoc

**Date**: 2026-05-18
**Status**: Accepted

## Context

JSDoc comments exist on the `Distribution` base class and namespace exports by convention, but
nothing enforces their presence or correctness. Standard.js has no JSDoc rules, and `.eslintrc.js`
adds none. Missing or stale docs on the public API go undetected until a consumer reads the source.

Two decisions were required:

1. **Where do JSDoc rules live?** Options were: add overrides to `.eslintrc.js`, or create a
   separate `.eslintrc.jsdoc.js` config invoked by a dedicated script. Standard.js bundles its
   own ESLint instance and ignores the project-level `.eslintrc.js`, making that file
   editor-hint-only. Adding JSDoc enforcement rules there would conflate editor hints with CI
   enforcement and couple two unrelated tooling concerns.

2. **How to scope `jsdoc/require-jsdoc` to the public API only?** The codebase has ~30 non-exported
   internal helper functions across namespace modules (`discreteMode`, `nTies`, `tau`, `trapezoid`,
   etc.). Using `require: { FunctionDeclaration: true }` would flag all of them, requiring either
   JSDoc on every helper or `eslint-disable` sprawl. AST `contexts` selectors can target only
   exported declarations.

## Decision

1. **Separate config file**: JSDoc rules live in `.eslintrc.jsdoc.js`, invoked by a dedicated
   `jsdoclint` npm script. This keeps `.eslintrc.js` as an editor-hint file and avoids coupling
   Standard.js tooling with ESLint-plugin tooling.

2. **Separate CI job**: A new `jsdoclint` job runs in parallel alongside the existing `lint`,
   `test`, `typecheck`, and `docs-build` jobs. This matches the established one-tool-per-job CI
   pattern and provides clear failure attribution.

3. **AST `contexts` selectors**: `jsdoc/require-jsdoc` is configured with `contexts` to target:
   - `ExportDefaultDeclaration > FunctionDeclaration` — anonymous default exports (most namespace functions)
   - `ExportNamedDeclaration > FunctionDeclaration` — named exports (`levene`, `generalLevene`, etc.)
   - `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression` — arrow exports (`seed` in core)
   - `MethodDefinition:not([key.name=/^_/]):not([kind=constructor])` — public class methods (excludes `_`-prefixed private methods and constructors)

4. **Plugin version**: `eslint-plugin-jsdoc@^50.8.0`. Version 62.x has a JSON schema incompatibility with ESLint 7's legacy config system — the `require-jsdoc` rule schema declares `additionalProperties: false` but ESLint 7 injects extra properties when merging config defaults, causing a validation error. Version 50.8.0 is the highest release that works cleanly with ESLint 7 and the AST `contexts` selector approach. No ESLint upgrade needed.

## Consequences

- **Easier**: Missing or stale `@param`/`@returns` tags on any public method or exported function
  are caught at CI time, not at documentation-build time or consumer read time.
- **Easier**: JSDoc rules can be evolved independently of Standard.js rules by editing `.eslintrc.jsdoc.js`.
- **Harder**: New public API additions (exported functions, Distribution methods) must include JSDoc
  or CI fails. This is the intended enforcement mechanism.
- **Neutral**: Private helpers (non-exported functions, `_`-prefixed class methods) are unaffected
  by the new rules.
