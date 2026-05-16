# ADR-0003: TypeScript Type Declarations Strategy

**Date**: 2026-05-16
**Status**: Accepted

## Context

ranjs has no `.d.ts` file. TypeScript consumers get no autocomplete, no parameter checking, and no return-type inference — a hard adoption blocker for any TypeScript project. The fix is a hand-written declaration file rather than migrating the source to TypeScript, which would be a separate, major undertaking.

Three decisions needed resolving:

1. **Where to place `"types"` in `package.json`**: The package already has an `"exports"` field (ADR-0001). TypeScript 4.7+ with `moduleResolution: "node16"`, `"nodenext"`, or `"bundler"` ignores the top-level `"types"` field entirely when `"exports"` is present — it reads only from `"exports"`. A top-level `"types"` entry alone is silently broken for all modern TypeScript consumers.

2. **How to type `Distribution.sample(n?)`**: The runtime returns a single `number` when `n < 2` and `number[]` when `n >= 2`. A generic conditional type (`N extends 0 | 1 ? number : number[]`) has a correctness bug: when `n` is a non-literal `number`, the conditional resolves to `number[]` only, which is false for `n = 0` or `n = 1`.

3. **TypeScript as devDependency**: The acceptance criteria require `tsc --noEmit` to pass, which needs `typescript` installed.

## Decision

1. **`"types"` in both locations**: Add `"types": "./dist/ranjs.d.ts"` at the top level of `package.json` (for legacy `moduleResolution: "node"` consumers) AND as the **first** condition inside `"exports"."."`  (for `"node16"`, `"nodenext"`, and `"bundler"` consumers). The `"types"` entry must be first in the exports object because Node.js and TypeScript match conditions in declaration order.

2. **Three-overload pattern for `sample()`**:
   ```typescript
   sample(): number;
   sample(n: 1): number;
   sample(n: number): number | number[];
   ```
   This gives correct narrow types for the dominant use case (no-arg → `number`) and the literal-1 case, and degrades correctly to `number | number[]` for dynamic arguments. The same overload pattern applies to `core.float()`, `core.int()`, and similar dual-return functions.

3. **`typescript` as devDependency only**: `typescript` is listed under `devDependencies` in `package.json`. It is not needed at runtime and is not in `dependencies`. A minimal `tsconfig.json` for `tsc --noEmit` validation is committed to the repository root.

## Consequences

- All TypeScript consumers — regardless of `moduleResolution` setting or TypeScript version — receive working autocomplete and type checking for ranjs.
- `tsc --noEmit` becomes part of the validation story (can be wired into CI later).
- The `.d.ts` file is hand-maintained and must be updated whenever the public API changes. It is not generated from source.
- `dist/ranjs.d.ts` is tracked in git alongside the built JS artifacts.
