---
date: 2026-05-16T11:35:00Z
category: "tooling"
problem: "Single-page-hardcoded docs build cannot produce a second page; a committed `style.css` was simultaneously a build target"
status: complete
related_issue: "#116"
related_plan: "thoughts/plans/2026-05-16-1120-docs-multipage.md"
tags: [docs, pug, sass, build-artifact, gitignore, mjpage, mathjax, layout, pages-array, byte-identity]
---

# Solution: Page-list-driven docs build with shared layout and externalized stylesheet

**Date**: 2026-05-16T11:35:00Z
**Category**: tooling
**Related Issue**: #116

## Problem

`docs/index.js` could produce exactly one HTML file. Adding a second page (changelog, porting guide, cookbook) would have required copy-pasting the entire pipeline: SCSS compile, `documentation` doclet shaping, Pug render, MathJax post-process, and `fs.writeFileSync` to `docs/index.html`. The single-page assumption was encoded throughout the script structure.

Additionally, `docs/styles/style.css` was a 36-line hand-maintained file containing `thead`/`tr`/`td`/`.param-*` rules — but the file path was *also* the natural target for compiled SCSS output. The hand-written rules did not exist in any `.scss` partial, so any future migration of the SCSS compile to write its result to `style.css` (the obvious move) would silently delete them. The file was simultaneously a source and an artifact.

Two cosmetic-but-real symptoms reinforced the trap: the Pug template `link`-loaded `style.css` *and* inlined the compiled SCSS via `<style>!{style}</style>`, so every future page would have to re-inline kilobytes of identical CSS; and the single `index.pug` baked the entire chrome (head, github banner, aside, search, footer JS), so a second page had nothing to extend.

## Root Cause

Three intersecting design flaws, each independently problematic:

1. **No abstraction over "a page"** — the script's body was an imperative recipe for *one* HTML file. The only ways to grow were duplication or a refactor.
2. **Ambiguous source/artifact role for `docs/styles/style.css`** — the file was committed *and* destined to be overwritten by `sass.renderSync` if anyone wired it that way. The 36 lines of CSS it contained had no corresponding `.scss` partial, making them invisible to the SCSS partial tree.
3. **Chrome (head + nav + banner + search-bar) baked into the only page template**, with no `_layout.pug` partial. A second page had no way to share head/nav markup without copy-paste.

The downstream symptoms (`<style>` inlined per page, every page recompiling the same CSS into HTML, no nav linking pages) all derive from these three roots.

## Fix

Three coordinated changes:

1. **`pages` array as single source of truth.** `docs/index.js` now defines `const pages = [{ template, output, navLabel, data }]` after the doclet shaping. A `for...of` loop renders each entry. The loop wraps `mjpage`'s callback-only API in `new Promise(...)` so each render is awaited serially — preventing any cross-page race in MathJax's global glyph cache. The nav (a `nav.page-nav` element in `_layout.pug`) iterates the same `pages` array, so adding one entry to `pages` adds a nav link automatically. Nav rendering is guarded by `if pages && pages.length > 1` so the single-page state stays visually identical to the pre-refactor output.

2. **Stylesheet is a build artifact.** `sass.renderSync` now writes to `docs/styles/style.css` once before the page loop. The file is added to `.gitignore`. The 36 orphaned hand-written rules were extracted into a new `_table.scss` partial and imported from `index.scss`, eliminating the source/artifact ambiguity. The inline `<style>!{style}</style>` block in the Pug template is gone; every page links the external stylesheet via `<link rel="stylesheet" href="styles/style.css">`. Browsers now cache the stylesheet across pages.

3. **Shared `_layout.pug`.** A new layout partial owns the `<head>`, the github banner, the `<aside>` shell, the `<main>` wrapper with nav guard, and the trailing search-bar script position. It exposes three blocks: `sidebar`, `content`, `scripts`. `index.pug` is now five lines of setup (`extends _layout` + three `block` declarations) wrapping the same install/demo/api markup.

The single-page rendered `docs/index.html` was confirmed byte-identical (`diff -q` empty) to the pre-refactor baseline. Multi-page capability was verified by temporarily adding a stub `pages` entry plus a 5-line `stub.pug`, observing that `docs/stub.html` was generated with the nav rendered, then reverting.

## Prevention Strategy

When a build script produces exactly one output file, treat the single-output assumption as a latent scalability bug — even when only one output is currently planned. The structural cost of "supports N outputs, currently configured for 1" is small (one array + one loop); the refactor cost paid later, when the second output is actually needed, is large because the assumption tends to leak into every line of the script. Encode the abstraction up front.

For any file that is **both committed to the repo and overwritten by a build step**, resolve the ambiguity immediately. The file must be either (a) a pure source — never written by any build — or (b) a pure artifact — `.gitignored`, regenerated from committed sources on every build, with all of its current contents traced back to a committed source file. Leaving the file in dual state silently invites a future build to delete real, working code. The forensic check is: `grep -rL "<contents-of-the-ambiguous-file>" <source-tree>` — if it returns no source file, you have orphaned content that lives only in the artifact.

For callback-based async APIs used inside a sequential loop, always wrap in `new Promise((resolve, reject) => api(..., result => { try { /* work */; resolve() } catch (err) { reject(err) } }))`. The `try`/`catch` inside the callback is mandatory: without it, a `writeFileSync` failure (disk full, permission denied) would surface as an unhandled exception thrown from a callback, with no path back to the awaiting loop. (Open caveat preserved as an inline WHY comment: APIs like `mjpage` whose callback signature has *no* error parameter can still hang if they fail internally and never invoke the callback — same behavior as before this refactor, not a new regression.)

When using a templating engine that supports layout inheritance (Pug `extends`, Jinja `extends`, Handlebars partials), introduce the shared layout the *first* time a second page is contemplated, not the second time. The cost is one file and one keyword (`extends`); the future savings scale linearly with page count.

## Related Solutions

- `solutions/tooling/2026-05-16-1220-badge-maker-svg-delegation.md` — same pattern of replacing imperative hand-rolled output construction with a structured delegate (there: badge-maker; here: a pages array + Pug layout inheritance). Reinforces that hand-rolled SVG/HTML inside a build script is technical debt the moment a second output is contemplated.
- `solutions/tooling/2026-05-14-1400-esm-shim-node20-breakage.md` — companion Node-20-readiness fix for the same toolchain (`@babel/register` replacing `esm`). The `node-sass` → `sass` migration consumed by this issue was likewise driven by Node-20-incompatibility.

## Key Insight

A file that is both committed to the repo and overwritten by a build step is a latent bug — resolve the ambiguity by tracing every line of its contents back to a committed source partial, then add the generated file to `.gitignore`. Leave it ambiguous and a future build will silently delete real working code.
