# ADR-0002: Docs build is driven by a `pages` array and a shared Pug layout

**Date**: 2026-05-16
**Status**: Accepted

## Context

`docs/index.js` originally rendered exactly one output file (`docs/index.html`) by compiling a single Pug template with the API reference inlined. GitHub Pages serves the entire `docs/` folder, so multiple pages are physically supported, but the build had no abstraction over "a page": adding a second page (changelog, porting guide, cookbook) would have required copy-pasting the SCSS compile, the doclet shaping, the template render, and the MathJax pass.

Two related problems compounded this: the compiled CSS was inlined into the page via a `<style>!{style}</style>` block (so each new page would have to re-inline the same kilobytes of CSS, defeating browser caching), and the Pug template had no shared layout (`<head>`, nav, footer all baked into `index.pug`).

## Decision

The docs build is page-list driven:

- `docs/index.js` exposes a top-level `pages` array. Each entry has `{ template, output, data, navLabel }`. The build loop renders each entry sequentially.
- The compiled SCSS is **written to disk** at `docs/styles/style.css` once before the page loop. Every page links it via `<link rel="stylesheet" href="styles/style.css">`. The inline `<style>!{style}</style>` block is removed from all templates.
- A shared layout partial `docs/templates/_layout.pug` owns the `<head>`, the GitHub banner, the search-bar/aside shell, and the page-level nav. Each page template uses `extends _layout` and declares its own `block content` (and other blocks where needed).
- The nav is data-driven: it is generated from the same `pages` array that drives the build loop. Adding an entry to `pages` automatically adds a nav link.
- The pre-existing manually-maintained rules in `docs/styles/style.css` (table/`thead`/param-name styles) are moved into a new SCSS partial `_table.scss` and imported from `index.scss`, so the compiled output remains the single source of truth.

## Consequences

**Easier:**
- Adding a new page is one entry in the `pages` array + one Pug template that extends the shared layout.
- Browsers cache `style.css` across pages; the per-page HTML payload shrinks by the size of the compiled CSS.
- The shared layout is the single edit point for cross-page chrome (header, nav, banner).

**Harder:**
- The `docs/styles/style.css` file is now a build artifact, not a hand-edited file. Anyone editing it directly will see their changes wiped by the next `npm run docs`. The new `_table.scss` partial is the correct edit target.
- The build now writes to two paths under `docs/` (`docs/styles/style.css` and one HTML per page) rather than just `docs/index.html`. CI/git-status workflows must expect both.

**Out of scope of this decision:**
- The content of additional pages (porting guide, cookbook, changelog) is not added here — only the build capability.
- Migration to a third-party static site generator (Astro, VitePress, etc.) remains deliberately rejected; the custom pipeline stays.
