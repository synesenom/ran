# Code Health vs. token spend

Tooling to test one question: **does working on a low-Code-Health file cost
more tokens than working on a healthy one, once you control for how big the
change is?**

## The three joins

| Quantity | Source | Limit |
| --- | --- | --- |
| Token spend | Claude Code Remote `list_sessions` → `external_metadata.usage` | Four aggregate counters per session. **Only populated for sessions created on or after 2026-07-20.** |
| Code Health | CodeScene CLI (`cs review --output-format=json`) re-run over historical blobs | None — any file version in git history can be scored, offline and unauthenticated |
| Change size | `git diff --numstat` between the merge commit's two parents | None |

A session is joined to its work through the branch name: the session's
outcome metadata records `claude/<slug>-<suffix>`, and the merge commit on
`main` names the same branch. In this repo that matched **594 of 596**
merged session branches.

## Why Code Health is recomputed rather than read from history

Past `code_health_score` calls are scattered through session transcripts
that no longer exist — remote session containers are destroyed when the
session ends, and only this pipeline's four aggregate counters survive.
Recomputing also guarantees every file version is measured identically.

The reconstruction was validated against commit messages that state the
score they achieved:

| Commit | Message claims | Recomputed (parent → commit) |
| --- | --- | --- |
| `3af2ae8` `noncentral-t.js` | 9.58 → 10.0 | 9.58 → 10.0 |
| `01a3139` `doubly-noncentral-t.js` | 9.43 → 10.0 | 9.43 → 10.0 |
| `6f54c33` `davis.js` | 9.38 → 10.0 | 9.38 → 10.0 |
| `205c43f` `irwin-hall.js` | 9.38 → 10.0 | 9.38 → 10.0 |

A `null` score means CodeScene found no functions to judge (barrel and
`index.js` files). That is absence of signal, not a failure, and those
files are dropped from the health aggregate rather than the session.

## Running it

```bash
# 1. In a Claude Code session, page through the sessions API and save each
#    page. Results large enough to spill to a file are ideal — pass those
#    files straight in.
#      list_sessions(limit=100, mine=true, after_id=<last_id of previous page>)

# 2. Build the panel (scores ~600 file versions; ~10 min at 6 workers)
export RANJS_ANALYSIS_DIR=/tmp/ranjs-analysis
python3 scripts/code-health-tokens/collect.py <saved-listing>*.txt

# 3. Fit the models
python3 scripts/code-health-tokens/analyse.py   # needs numpy + scipy
```

`CS_BIN` overrides the CodeScene CLI path; the CodeScene MCP server caches
it under `~/.cache/codehealth-mcp/<version>/cs`. No CodeScene account is
needed — `cs review` scores a file locally.

## Interpreting the output

Two blocks are printed. The second one — excluding sessions whose purpose
*was* raising a file's Code Health — is the one to read. Those sessions
choose their target *because* it scores badly and the fix is small and
well-specified, so leaving them in makes bad health look cheap and flips
the sign of the estimate.

`analyse.py` also prints the smallest effect the data could have detected.
Read that before believing any null result: in this repo the binding
constraint is not sample size but the near-absence of unhealthy code to
study.

## Attributing tokens to coding rather than chatter

Session totals mix coding with planning, PR babysitting and review
chatter, and an archived session cannot be decomposed after the fact.
`session-telemetry.py` is a `Stop` hook that captures the split while the
session is still alive, by parsing its transcript:

```json
{ "hooks": { "Stop": [ { "hooks": [ { "type": "command",
  "command": "$CLAUDE_PROJECT_DIR/scripts/code-health-tokens/session-telemetry.py" } ] } ] } }
```

It appends one record per session with output tokens split by turn kind
(`edit` / `explore` / `converse`), a per-edited-file breakdown, and tool
call counts.

Two things it has to get right, and does:

- The transcript writes **one line per content block**, and every line of a
  message repeats that message's full `usage`. Summing over lines
  double- or triple-counts; records are deduped on `requestId`.
- Under `auto` permissions, edits arrive as shell redirects and in-place
  `sed` rather than `Edit`/`Write` calls, so a classifier keyed only on
  tool names scores an entire coding session as `explore`. Shell writes are
  detected and attributed too.

Remote session containers are ephemeral, so the output file must be
committed on the session's branch (or shipped elsewhere) to survive.
