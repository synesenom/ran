---
date: 2026-05-24T14:39:26Z
category: "tooling"
problem: "New SCSS selectors authored for one docs page silently matched elements on the other page through the single shared compiled stylesheet"
status: complete
related_issue: "#209"
related_plan: "thoughts/plans/2026-05-24-1402-porting-guide-styling.md"
tags: [docs, scss, sass, cross-page-leak, has-selector, shared-stylesheet, pages-array, multi-page-build, porting-guide, sidebar, regression]
---

# Solution: Shared-stylesheet cross-page selector leak in the docs build

**Date**: 2026-05-24T14:39:26Z
**Category**: tooling
**Related Issue**: #209
**Related Plan**: `thoughts/plans/2026-05-24-1402-porting-guide-styling.md`
**Related ADR**: `decisions/0002-docs-pages-array.md`

## Problem

When adding a new SCSS partial `docs/styles/_porting.scss` to fix styling
gaps on the second docs page (`docs/porting-scipy.html`, added in PR #208),
two seemingly page-specific selectors silently leaked to the API page
(`docs/index.html`):

1. `main p { margin-bottom: 12px }` — intended to give the porting guide's
   multi-paragraph prose vertical air. `main p` matches the API page's two
   `<p>` elements (the "what is this?" intro paragraph at `index.pug:22` and
   the demo links paragraph at `index.pug:33-35`), overriding the
   intentional `margin: 0` set globally in `main.scss:19-23`.
2. `aside ul.sections > li:first-child { margin-top: 20px }` — intended to
   give the porting sidebar's first section top air, since it has no
   `.search-bar` sibling above. `aside ul.sections > li:first-child`
   matches the first `<li>` on every page that links the stylesheet,
   including the API page, where the search bar already supplies its own
   spacing. The rule would have pushed the API sidebar's first section
   down 20 px.

The implementation's own WHY comment asserted: "Selectors are scoped
narrowly enough... that they do not regress the API page" — a claim the
source cannot verify on its own, and which was false for both selectors.

## Root Cause

The docs pipeline (ADR-0002) compiles a single `docs/styles/style.css`
from `docs/styles/index.scss` and serves it to every page in the
`pages` array. There is no CSS cascade boundary between pages — every
selector in every partial is in scope for every page that links the
stylesheet. A rule authored while looking at one page's DOM has no
automatic restriction to that page; it takes effect wherever the
selector matches.

Because the issue scope forbade template edits, no `body.porting` /
`main.porting` scope class could be added to the porting template.
Without a structural firewall, any rule using a generic element
selector (`p`, `li:first-child`, bare tag selectors) had to either:

- match identically-typed elements on both pages, or
- use a structural `:has()` condition on something that differs
  between the two pages, or
- be authored as a class selector (`.code-pair`, `p.callout`) tied to
  markup that only appears on one page.

The plan's risk assessment acknowledged the global-selector concern but
applied "the API page only has one `<p>`" as evidence that `main p` was
safe — which only proves the scope is small, not that the rule is a
no-op. A 12 px bottom margin on a singleton paragraph that happens to
have nothing immediately below it is still a behavioral regression, not
a benign no-op (e.g., it affects baseline alignment with the next
section's top margin and is observable in dev tools).

## Fix

Two structural fixes, no template edits:

1. **`main p` rule removed entirely.** The porting page's surrounding
   block margins on `h1` (60 px top), `h2` (50 px top), `table`
   (24 px bottom), `.code-pair` (12 px), and `p.callout` (16 px) already
   provide vertical rhythm between prose paragraphs. There are no
   consecutive `<p>` siblings anywhere on the porting page, so the rule
   was solving a non-problem and could be deleted rather than scoped.

2. **`aside ul.sections > li:first-child` scoped with `aside:not(:has(
   .search-bar))`.** This exploits the structural difference between
   the two pages: the API page's `<aside>` contains `.search-bar`
   (`index.pug:8-9`); the porting page's does not. The `:has()`-based
   page distinction was already used in the same partial for the
   non-interactive label cursor rule
   (`ul.sections label:not(:has(+ input))`), making the pattern
   internally consistent.

A defensive CI smoke-test extension was also added
(`.github/workflows/ci.yml:101`): the docs-build job now asserts
`docs/porting-scipy.html` exists in addition to `docs/index.html` and
`docs/styles/style.css`, so a future regression that silently drops
the second page would be caught.

The first leak was caught by the build pipeline's bug-triage stage
(`ops-triage` agent), classified as a definite regression in the same
PR, and fixed in-flight rather than filed as a follow-up issue
(filing a separate issue against the same PR for a bug it introduces
would have been ridiculous). The second leak was caught by the review
stage's independent correctness re-analysis after the first patch.
Both stages catching live regressions is evidence the post-implement
pipeline (triage + review) is working as designed.

## Prevention Strategy

Before merging any new SCSS rule that uses an unclassed element
selector (bare tag, pseudo-class on a tag, descendant/child combinator
without a class anchor), **explicitly read the DOM tree of every other
page that links the shared compiled stylesheet** and ask: "Does this
selector match anything in that DOM tree?" A WHY comment asserting
narrow scoping is not evidence — only a check against the other
page's actual markup is.

When a rule genuinely needs to be page-specific but template edits
are out of scope, use a `:has()` condition on a **page-distinguishing
structural element** rather than relying on DOM-count reasoning
("the API page only has one `<p>`"). For the ranjs docs build, the
page-distinguishing element is `.search-bar` inside `aside` — the
API page has one, the porting page does not. Patterns:

```scss
// Match only when the page-distinguishing element is absent.
aside:not(:has(.search-bar)) ul.sections > li:first-child {
  margin-top: 20px;
}

// Match only when a specific sibling relationship holds (here:
// labels that have a checkbox toggle vs. decorative labels).
ul.sections label:not(:has(+ input)) {
  cursor: default;
}
```

For new selectors whose intended scope is "this one page", prefer
class selectors on markup that only appears on that page
(`.code-pair`, `p.callout`, `h2#dist-*`) over bare tag selectors
(`p`, `h2`, `table`). When a bare tag selector is unavoidable
(e.g., styling the second page's standalone tables), use a structural
parent combinator that the other page does not satisfy:
`main > table` matches the porting page's direct-child tables but
not the API page's `main > .card > table.margined`.

For the workflow itself: a CI smoke test that asserts every page in
the `pages` array exists after `npm run docs` is cheap insurance.
The pattern `test -f docs/<page>.html` per page in the workflow's
`docs-build` job costs one line per page and catches both build
failures and accidental drops of `pages[]` entries.

## Related Solutions

- `solutions/tooling/2026-05-16-1135-docs-pages-array-build.md` —
  Established the page-list-driven build and externalized stylesheet
  that this solution is downstream of. That solution warned about the
  source/artifact ambiguity of `style.css`; this solution warns about
  the cross-page leak risk of the same single stylesheet now being
  loaded by N pages. Both lessons compound: page-list builds are
  cheap to grow, but each new page widens the surface where unscoped
  selectors silently regress earlier pages.

## Key Insight

In a single shared-stylesheet docs build, "this selector only
matches the new page" must be **verified by inspecting the other
page's DOM tree**, not inferred from element count or comment
assertion — and when template-level scoping classes are unavailable,
CSS `:has()` conditions on a structurally unique element (e.g.,
`aside:not(:has(.search-bar))`) are the correct isolation
mechanism.
