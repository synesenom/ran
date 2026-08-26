---
date: 2026-08-26T09:00:00Z
category: "tooling"
problem: "A /review convention-checking agent raised a Block-severity CLAUDE.md violation by checking the rule's literal text without cross-referencing how the same rule is already satisfied by accepted precedent elsewhere in the codebase"
status: complete
related_issue: "#1270"
related_plan: "thoughts/plans/2026-08-26-0630-issue-1270-test-precision-gate.md"
tags: [tooling, code-review, false-positive, precedent, conventions, generated-files]
---

# Solution: A review-conventions Block finding was a false positive from not checking precedent

**Date**: 2026-08-26T09:00:00Z
**Category**: tooling
**Related Issue**: #1270

## Problem

During `/review` of the new `test/precision-test.js` (issue #1270's hypothesis-test precision gate), the `review-conventions` agent raised a **Block**-severity finding: that the `REFS` array's entries violate CLAUDE.md's "Reference values must be externally sourced" rule ("Mark each with a comment naming the tool and showing the computation") because they lack a per-literal `// R 4.3.3: ...` comment next to each `refStat`/`refPValue` value. Taken at face value, this would have required restructuring the generated file's provenance format before the branch could be considered mergeable.

## Root Cause

The reviewing agent checked the CLAUDE.md rule's literal wording in isolation, without cross-referencing how that exact same rule is already implemented by the nearest structural precedent in the codebase. Two other existing, long-accepted generated precision-gate files — `test/precision-summary-stats.js` and `test/precision-special.js` — both satisfy the identical rule via a **file-level-only** provenance convention: one header comment naming the generator script and external tool once, with **zero** per-literal comments, and no history of pushback on that choice. The rule's text ("mark each... with a comment") was written primarily with hand-authored `closeTo()` assertions in behavioral test files in mind; the established, working interpretation for *generated* precision-gate files is that the generator script itself (named once at the top of the output file) is the audit trail, since every value is reproducible by re-running it — verified directly with `grep -c "// mpmath\|// R \|// scipy"` against both existing files (0 matches in each) before accepting or rejecting the finding.

## Fix

The finding was verified against the codebase directly before being acted on, confirmed as a false positive relative to established precedent, and **not** actioned — acting on it would have meant deviating from convention (annotating only the new file while two existing sibling files remain unannotated), which is the opposite of what "conventions" review should produce. This was documented explicitly in the `/review` report's `Conflict` section as "reviewed and rejected — matches established codebase precedent," rather than silently dropped or silently fixed.

## Prevention Strategy

When a review agent (automated or human) flags a CLAUDE.md rule violation in a file that follows an existing structural pattern (a generated file, a per-module test shard, a precision gate, etc.), **grep the nearest sibling files for how the same rule is already satisfied there** before accepting the finding as valid — a rule's literal wording can have an established, accepted implementation convention that differs from a naive first read (e.g., "one comment per group of values" vs. "one comment per individual literal") and that isn't visible from the rule text alone. This applies with particular force to this codebase's own `/review` skill's automated convention-checking agents (`review-conventions`), whose findings are generated fresh each run with no persistent memory of prior review outcomes on sibling files — a Block finding from that agent should be spot-verified against precedent (a quick `grep`/`Read` of the nearest comparable existing file) before it is trusted to block a commit, exactly as would be done for a Warn or Conflict finding, not just accepted because it cites the rule text correctly.

## Related Solutions

- None found — no prior solution documents a review-agent false positive arising from rule-text-only checking versus convention-in-practice checking.

## Key Insight

A review agent's rule-compliance finding can be a false positive even when it quotes the rule's text correctly — always grep the nearest structural precedent (a sibling generated file, an equivalent module) before accepting a Block-severity conventions finding, since an established codebase can satisfy a rule's intent through a convention the rule's literal wording doesn't spell out.
