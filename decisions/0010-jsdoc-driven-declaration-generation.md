# ADR-0010: JSDoc-Driven TypeScript Declaration Generation

**Date**: 2026-05-23
**Status**: Accepted
**Supersedes**: ADR-0003 (TypeScript Type Declarations Strategy)

## Context

ADR-0003 established a hand-written `dist/ranjs.d.ts` maintained alongside the source. The
`scripts/check-declarations.js` CI check verifies structural completeness (every export has a
declaration) but cannot catch **behavioral drift** — a declared parameter or return type that no
longer matches the runtime behaviour. That class of error is invisible until a consumer hits a
compile error in their own TypeScript project.

The JSDoc `@param` and `@returns` annotations are already written on every public method
throughout the source. Running `tsc --allowJs --declaration --emitDeclarationOnly` derives
`.d.ts` files from those annotations, making drift structurally impossible: any annotation
mismatch becomes a type error at build time.

Three structural incompatibilities between the existing source and what tsc requires were
identified through empirical testing:

1. **Anonymous class exports**: All 140 distribution files use `export default class extends
   Distribution`. tsc names these `_default` in generated declarations. Explicit names produce
   clean, readable error messages and IDE tooltips.

2. **`@param` placement**: tsc only reads `@param` from the JSDoc block immediately preceding the
   `constructor()` method. The existing `@param` tags are on the class-level comment (before
   `class`), which is correct for the `documentation` package used by the docs generator, but
   ignored by tsc for constructor typing. Tags must be duplicated onto the constructor method.

3. **JSDoc union type syntax**: `{(number|number[])}` (extra parens, valid JSDoc 3) is
   unrecognised by tsc. The correct form is `{number|number[]}`.

## Decision

1. **Generate declarations via `tsc --allowJs`**: Add a `tsconfig.build.json` (separate from the
   type-check-only `tsconfig.json`) that enables `allowJs`, `declaration`, `emitDeclarationOnly`,
   `rootDir: "src"`, and `outDir: "dist"`. The `npm run build` script gains a second step that
   invokes this config after Rollup.

2. **Multi-file output, `dist/index.d.ts` as entry**: tsc generates one `.d.ts` per source file.
   The root entry is `dist/index.d.ts` (from `src/index.js`). No bundler plugin is added. The
   `package.json` top-level `"types"` field and `exports["."].types` both point to
   `./dist/index.d.ts`. The `tsconfig.json` paths map is updated to match.

3. **Duplicate `@param` on constructor methods**: Class-level `@param` tags are preserved (the
   `documentation` docs generator reads them there). An identical set is added to the
   `constructor()` method JSDoc so tsc picks up the types. The constructor-level block is minimal:
   only `@param` lines, no `@class`, `@memberof`, `@see`, `@example` tags.

4. **Name all 140 distribution classes**: `export default class extends Distribution` becomes
   `export default class <Name> extends Distribution`. The name matches the re-export alias in
   `src/dist/index.js` (e.g. `export { default as Normal }` → `class Normal`). This is a
   mechanical, non-breaking change (the exported binding name is unchanged).

5. **Delete `scripts/check-declarations.js`**: Structural completeness is now guaranteed by tsc
   generating declarations from the actual exports. The check-declarations script's sole purpose
   was to compensate for the hand-maintained file; it is no longer needed.

6. **Remove `dist/ranjs.d.ts` from version control**: The file becomes a build artifact. A
   `/dist/*.d.ts` gitignore rule (replacing the explicit `!dist/ranjs.d.ts` entry) covers all
   generated declaration files.

7. **`@overload` for `sample()`** in `_distribution.js` and `@overload` + `@template` for the
   overloaded/generic functions in `src/core/index.js`. This preserves the three-overload pattern
   from ADR-0003 in the generated output.

## Consequences

- **Easier**: Behavioral drift (wrong parameter or return types) is now caught at build time.
  Adding a new distribution automatically produces a correct declaration when `npm run build` runs.
- **Easier**: `scripts/check-declarations.js` is deleted; one less maintenance surface.
- **Harder**: Every distribution constructor must have a JSDoc block on the `constructor()` method.
  New distributions that omit this will have `any`-typed constructors in the generated declaration.
  The jsdoclint rule for constructors should be enabled to enforce this.
- **Changed**: `package.json` `"types"` changes from `dist/ranjs.d.ts` to `dist/index.d.ts`.
  Any consumer pinning to the specific filename is affected (extremely unlikely in practice).
- **Changed**: The gitignore pattern changes from `!dist/ranjs.d.ts` (explicit negation) to a
  rule that ignores all generated `.d.ts` in `dist/`. No committed `.d.ts` file exists after this
  change.
