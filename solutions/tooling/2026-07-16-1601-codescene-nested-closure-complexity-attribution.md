---
date: 2026-07-16T16:01:00Z
category: "tooling"
problem: "CodeScene scores a factory function's cyclomatic complexity as the sum of every closure it returns"
status: complete
related_issue: "#828"
related_plan: "thoughts/plans/2026-07-16-1530-mala-sampler.md"
tags: [codescene, code-health, cyclomatic-complexity, closures, test-helpers]
---

# Solution: CodeScene attributes nested closures' complexity to their enclosing named function

**Date**: 2026-07-16
**Category**: tooling
**Related Issue**: #828

## Problem

A new test helper factory function (`ar1Target5D`) added for `ran.mc.MALA`'s ESS-vs-RWM comparison test scored CodeScene cyclomatic complexity **10**, over the `code_health_score` threshold of 9 — flagged as a "Complex Method" smell requiring a fix before the file could re-reach a 10.0 score, per `CLAUDE.md`'s mandatory Code Health rule. Neither of the two closures the function built (`lnp`, a density; `gradLnp`, its gradient) was independently complex — each was a single small loop with a ternary and (for `gradLnp`) two `if` guards.

## Root Cause

CodeScene attributes a nested closure's cyclomatic complexity to its **enclosing named function**, not to the closure itself as a separate unit. `ar1Target5D` declared two arrow-function closures inline (`const lnp = x => {...}`, `const gradLnp = x => {...}`) and returned both as `{ lnp, gradLnp }`. Because both closures were syntactically nested inside `ar1Target5D`, their branch counts summed into `ar1Target5D`'s own score — even though at runtime `lnp` and `gradLnp` are independent functions, never called from within each other, and each is trivially simple on its own.

This is a scoring-tool attribution artifact, not a real complexity problem in either closure — but it behaves exactly like a real complexity smell from the tool's perspective and must be addressed the same way.

## Fix

Split the single multi-closure factory into two separate top-level factory functions, one closure per function, sharing a small helper to avoid duplicating the precision-matrix-entry arithmetic between them:

```js
function ar1PrecisionEntries (rho) { /* returns { diagEdge, diagMid, offDiag } */ }
function ar1Diag (i, diagEdge, diagMid) { /* small shared ternary */ }
function ar1LogDensity5D (rho) { /* returns one closure: the density */ }
function ar1GradLogDensity5D (rho) { /* returns one closure: the gradient */ }
```

(`test/mc.js`, above the `describe('5D correlated Normal ESS comparison', ...)` block.) After the split, `test/mc.js` returned to a 10.0 Code Health score.

## Prevention Strategy

When a helper factory function is about to create and return **more than one** nontrivial closure (a density and its gradient, a getter/setter pair, two related callbacks), split them into separate top-level factory functions from the start rather than bundling them into one. CodeScene sums nested closures' complexity into the enclosing function's score, so "one function returns two closures" costs roughly the **sum** of both closures' complexity, not the max of either — a pattern that looks clean and DRY in review can still trip the threshold.

Run `code_health_score` immediately after adding any multi-closure helper (as `CLAUDE.md`'s Code Health rule already requires for every touched `.js` file) rather than waiting until the end of a phase — the fix (splitting into separate functions, sharing a small arithmetic helper if needed) is nearly free when caught immediately and only marginally more work if caught late.

## Related Solutions

None found with this specific attribution-artifact shape; closest prior `mc`-module tooling solution is `solutions/tooling/2026-07-15-1230-jsdoclint-src-mc-coverage-gap.md` (a different tool, same module, same "audit immediately after touching a file" discipline).

## Key Insight

CodeScene attributes a nested closure's cyclomatic complexity to its enclosing named function — a factory that creates two or more loop-bearing closures (e.g. pairing a density function with its gradient) scores as if their complexities were summed, so split each closure into its own top-level function before it happens, not after the score comes back low.
