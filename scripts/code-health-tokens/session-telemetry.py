#!/usr/bin/env python3
"""Stop hook: attribute a session's token spend to the files it edited.

Session-level totals from the Claude Code Remote API mix coding with
planning, PR babysitting and review chatter, and they cannot be
decomposed after the fact — an archived session exposes four aggregate
counters and nothing else. The live transcript still has per-message
`usage`, so the split has to be captured while the session is running.

Reads the Stop-hook JSON payload on stdin and appends one JSON record to
$RANJS_TELEMETRY (default .claude/session-telemetry.jsonl).

Gotcha this deliberately guards against: the transcript writes one line
per content block, and every line of a message repeats that message's
full `usage`. Summing over lines triple-counts. Dedupe on requestId.
"""
import json, os, sys, collections

import re

MUTATING = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
READING = {"Read", "Grep", "Glob", "Bash", "WebFetch", "WebSearch"}

# In auto mode file edits arrive as shell redirects and in-place sed rather
# than Edit/Write tool calls, so a tool-name-only classifier would score a
# whole session as "explore". These patterns recover the written path.
BASH_WRITE = [
    re.compile(r">>?\s*([\w./~$-]+\.\w+)"),
    re.compile(r"\bsed\b[^|;]*?-i[^|;]*?\s([\w./~$-]+\.\w+)"),
    re.compile(r"\btee\b\s+(?:-a\s+)?([\w./~$-]+\.\w+)"),
]


def bash_writes(cmd):
    """Paths a shell command appears to write to."""
    found = set()
    for pat in BASH_WRITE:
        found.update(pat.findall(cmd or ""))
    return {f for f in found
            if not f.startswith(("/dev/", "/tmp/"))
            # ">= 10.0" and friends match the redirect pattern; require a
            # real alphabetic extension so numeric comparisons drop out.
            and re.search(r"\.[A-Za-z]{1,5}$", f)}


def classify(tools):
    if "Bash:write" in tools or tools & MUTATING:
        return "edit"
    if tools & READING:
        return "explore"
    return "converse"


def main():
    payload = json.load(sys.stdin)
    path = payload.get("transcript_path")
    if not path or not os.path.exists(path):
        return

    turns = {}                       # requestId -> merged turn
    for line in open(path, errors="ignore"):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if d.get("type") != "assistant":
            continue
        rid = d.get("requestId") or d.get("uuid")
        msg = d.get("message", {})
        t = turns.setdefault(rid, {"usage": msg.get("usage") or {}, "tools": set(), "files": set()})
        for block in msg.get("content", []) or []:
            if block.get("type") != "tool_use":
                continue
            name = block.get("name", "")
            t["tools"].add(name)
            args = block.get("input") or {}
            fp = args.get("file_path")
            if fp and name in MUTATING:
                t["files"].add(fp)
            if name == "Bash":
                w = bash_writes(args.get("command"))
                if w:
                    t["tools"].add("Bash:write")
                    t["files"].update(w)

    by_kind = collections.Counter()
    by_file = collections.Counter()
    tool_calls = collections.Counter()
    totals = collections.Counter()
    for t in turns.values():
        u = t["usage"]
        out = u.get("output_tokens", 0) or 0
        totals["output"] += out
        totals["thinking"] += (u.get("output_tokens_details") or {}).get("thinking_tokens", 0) or 0
        totals["cache_read"] += u.get("cache_read_input_tokens", 0) or 0
        totals["cache_write"] += u.get("cache_creation_input_tokens", 0) or 0
        by_kind[classify(t["tools"])] += out
        for name in t["tools"]:
            tool_calls[name] += 1
        # An edit turn's output is split evenly across the files it wrote:
        # finer attribution would need per-block token counts, which the
        # API does not report.
        if t["files"]:
            share = out / len(t["files"])
            for f in t["files"]:
                by_file[os.path.relpath(f, os.environ.get("CLAUDE_PROJECT_DIR", "/"))] += share

    rec = {
        "session_id": payload.get("session_id"),
        "cwd": payload.get("cwd"),
        "turns": len(turns),
        "tokens": dict(totals),
        "output_by_turn_kind": dict(by_kind),
        "output_by_edited_file": {k: round(v) for k, v in by_file.most_common()},
        "tool_calls": dict(tool_calls.most_common()),
    }
    dest = os.environ.get("RANJS_TELEMETRY") or os.path.join(
        os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude", "session-telemetry.jsonl")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "a") as fh:
        fh.write(json.dumps(rec) + "\n")


if __name__ == "__main__":
    main()
