#!/usr/bin/env python3
"""Build the session-level panel: token spend x prior Code Health x change size.

Three sources have to be joined, and each imposes a different limit:

  1. Token spend  — Claude Code Remote `list_sessions`, which reports four
     aggregate counters per session and nothing finer. Save each page of
     that tool's JSON output to a file and pass the files as arguments.
     Usage counters only exist for sessions created from 2026-07-20 on.
  2. Code Health  — recomputed from history with the CodeScene CLI rather
     than read off past `code_health_score` calls, so every file version
     is measured the same way and nothing depends on a tool call having
     happened. Validated against commit messages that state the before /
     after score (see README).
  3. Change size  — git, joined to a session through the branch name that
     the session's outcome metadata records.

Usage: collect.py <session-listing.json> [more.json ...]
"""
import collections, json, os, re, subprocess, sys, tempfile, threading
from concurrent.futures import ThreadPoolExecutor

REPO = os.environ.get("RANJS_REPO", os.getcwd())
OUT = os.environ.get("RANJS_ANALYSIS_DIR", "/tmp/ranjs-analysis")
CS = os.environ.get("CS_BIN") or os.path.expanduser(
    "~/.cache/codehealth-mcp/MCP-1.4.1/cs")
WORKERS = int(os.environ.get("RANJS_WORKERS", "6"))


def git(*a):
    return subprocess.run(["git", "-C", REPO] + list(a),
                          capture_output=True, text=True).stdout


def load_sessions(paths):
    """Flatten saved `list_sessions` pages into branch -> token totals."""
    out = {}
    for p in paths:
        for s in json.load(open(p))["ccr"]["data"]:
            ctx = s.get("session_context") or {}
            usage = (s.get("external_metadata") or {}).get("usage") or {}
            if not usage:
                continue                      # pre-2026-07-20: no telemetry
            branches = []
            for o in ctx.get("outcomes") or []:
                branches += ((o.get("git_repository") or {}).get("git_info") or {}).get("branches") or []
            for b in branches:
                rec = out.setdefault(b, collections.Counter())
                rec["output"] += usage.get("output_tokens", 0)
                rec["input"] += usage.get("input_tokens", 0)
                rec["cache_write"] += usage.get("cache_write_tokens", 0)
                rec["cache_read"] += usage.get("cache_read_tokens", 0)
                rec["sessions"] += 1
    return out


def session_merges():
    """Merge commits on main that landed a `claude/*` session branch."""
    merges = []
    for line in git("log", "origin/main", "--merges", "--format=%H|%ad|%P|%s",
                    "--date=short").splitlines():
        sha, date, parents, subject = line.split("|", 3)
        if "from synesenom/claude/" not in subject:
            continue
        ps = parents.split()
        if len(ps) != 2:
            continue
        merges.append(dict(sha=sha, date=date, base=ps[0], head=ps[1],
                           branch=subject.split("from synesenom/")[1].strip()))
    return merges


def changed_files(m):
    rows = []
    for line in git("diff", "--numstat", m["base"], m["head"]).splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        add, dele, path = parts
        if not path.endswith(".js") or path.startswith("dist/"):
            continue
        rows.append(dict(path=path, add=0 if add == "-" else int(add),
                         dele=0 if dele == "-" else int(dele)))
    return rows


def resolve_blobs(specs):
    """rev:path -> blob sha, so identical file versions are scored once."""
    specs = sorted(specs)
    lines = subprocess.run(["git", "-C", REPO, "cat-file",
                            "--batch-check=%(objectname) %(objecttype)"],
                           input="\n".join(specs) + "\n",
                           capture_output=True, text=True).stdout.splitlines()
    out = {}
    for spec, line in zip(specs, lines):
        parts = line.split()
        if len(parts) == 2 and parts[1] == "blob":
            out[spec] = parts[0]
    return out


def score_blobs(blobs, cache_path):
    """`cs review` each unique blob. Runs offline; no CodeScene account needed."""
    done = {}
    if os.path.exists(cache_path):
        for line in open(cache_path):
            d = json.loads(line)
            done[d["blob"]] = d
    todo = [b for b in blobs if b not in done]
    if not todo:
        return done
    env = dict(os.environ, CS_DISABLE_VERSION_CHECK="1")
    tmp = tempfile.mkdtemp()
    lock = threading.Lock()
    fh = open(cache_path, "a")

    def one(b):
        path = os.path.join(tmp, b + ".js")
        with open(path, "wb") as f:
            subprocess.run(["git", "-C", REPO, "cat-file", "blob", b],
                           stdout=f, check=True)
        rec = {"blob": b, "nloc": sum(1 for _ in open(path, errors="ignore")),
               "score": None}
        try:
            r = subprocess.run([CS, "review", "--output-format=json", path],
                               capture_output=True, text=True, timeout=180, env=env)
            # A null score means CodeScene found no functions to judge
            # (barrel/index files); that is "no signal", not a failure.
            rec["score"] = json.loads(r.stdout).get("score")
        except Exception as exc:
            rec["error"] = str(exc)[:200]
        os.remove(path)
        with lock:
            fh.write(json.dumps(rec) + "\n")
            fh.flush()
        return rec

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for i, rec in enumerate(ex.map(one, todo), 1):
            done[rec["blob"]] = rec
            if i % 100 == 0:
                sys.stderr.write(f"  scored {i}/{len(todo)}\n")
    return done


def branch_effort(m):
    """Commit count and cumulative churn — net diff hides write/rewrite thrash."""
    commits = [l for l in git("log", f"{m['base']}..{m['head']}",
                              "--no-merges", "--format=%H").splitlines() if l]
    churn = 0
    for sha in commits:
        for line in git("show", "--numstat", "--format=", sha).splitlines():
            parts = line.split("\t")
            if len(parts) == 3 and parts[0] != "-":
                churn += int(parts[0]) + int(parts[1])
    return len(commits), churn


def main(argv):
    os.makedirs(OUT, exist_ok=True)
    tokens = load_sessions(argv)
    merges = [m for m in session_merges() if m["branch"] in tokens]
    sys.stderr.write(f"sessions with both a merged branch and token telemetry: {len(merges)}\n")

    files = {m["branch"]: changed_files(m) for m in merges}
    specs = {f"{m[end]}:{f['path']}" for m in merges for f in files[m["branch"]]
             for end in ("base", "head")}
    blobmap = resolve_blobs(specs)
    scores = score_blobs(sorted(set(blobmap.values())), os.path.join(OUT, "scores.jsonl"))

    panel = []
    for m in merges:
        src = [f for f in files[m["branch"]] if f["path"].startswith("src/")]
        health, weights, new_files = [], [], 0
        for f in src:
            spec = f"{m['base']}:{f['path']}"
            if spec not in blobmap:
                new_files += 1                # created by this session: no prior health
                continue
            rec = scores.get(blobmap[spec])
            if rec is None or rec.get("score") is None:
                continue
            health.append(rec["score"])
            weights.append(rec["nloc"] or 1)
        if not health:
            continue
        n_commits, churn = branch_effort(m)
        # Sessions whose whole purpose was raising a file's Code Health pick
        # their target *because* it scores badly, and the fix is small and
        # well-specified. Leaving them in makes low health look cheap.
        smell_fix = bool(re.search(r"smell|code.?health", m["branch"], re.I))
        t = tokens[m["branch"]]
        panel.append(dict(
            branch=m["branch"], date=m["date"], smell_fix=smell_fix,
            health_min=min(health), health_mean=sum(health) / len(health),
            health_wmean=sum(h * w for h, w in zip(health, weights)) / sum(weights),
            src_nloc=sum(weights), n_src=len(src), n_src_rated=len(health),
            new_files=new_files,
            loc_src=sum(f["add"] + f["dele"] for f in src),
            loc_all=sum(f["add"] + f["dele"] for f in files[m["branch"]]),
            n_commits=n_commits, churn_commits=churn,
            output=t["output"], input=t["input"],
            cache_write=t["cache_write"], cache_read=t["cache_read"]))
    json.dump(panel, open(os.path.join(OUT, "panel.json"), "w"), indent=1)
    sys.stderr.write(f"panel rows written: {len(panel)}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
