#!/usr/bin/env python3
"""Does prior Code Health predict token spend, once change size is controlled?

Reads the panel written by collect.py. Reports the effect of losing one
Code Health point on four outcomes, and — more importantly — the smallest
effect the available data could have detected. Requires numpy and scipy.

Usage: analyse.py [panel.json]
"""
import json, os, sys
import numpy as np
from scipy import stats

PANEL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.environ.get("RANJS_ANALYSIS_DIR", "/tmp/ranjs-analysis"), "panel.json")


def design(rows):
    """Smell severity plus the two things that obviously drive effort anyway."""
    severity = np.array([10.0 - r["health_min"] for r in rows])
    return severity, np.column_stack([
        np.ones(len(rows)), severity,
        np.log1p([r["loc_all"] for r in rows]),
        np.log([r["n_src"] for r in rows])])


def fit(y, X):
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ beta
    dof = len(y) - X.shape[1]
    cov = (resid @ resid / dof) * np.linalg.pinv(X.T @ X)
    return beta, np.sqrt(np.diag(cov)), dof


def report(rows, outcome, label):
    y = np.log(np.array(outcome, float) + 1)
    _, X = design(rows)
    beta, se, dof = fit(y, X)
    crit = stats.t.ppf(0.975, dof)
    lo, hi = beta[1] - crit * se[1], beta[1] + crit * se[1]
    p = 2 * stats.t.sf(abs(beta[1] / se[1]), dof)
    pct = lambda b: (np.exp(b) - 1) * 100
    print(f"  {label:28s} {pct(beta[1]):+6.0f}%  95% CI [{pct(lo):+.0f}%, {pct(hi):+.0f}%]  p={p:.3f}")


def power(rows):
    """The binding constraint is variation in health, not sample size."""
    severity, X = design(rows)
    ctrl = X[:, [0, 2, 3]]
    resid = severity - ctrl @ np.linalg.lstsq(ctrl, severity, rcond=None)[0]
    y = np.log(np.array([r["output"] for r in rows], float) + 1)
    sigma = np.std(y - X @ np.linalg.lstsq(X, y, rcond=None)[0], ddof=X.shape[1])
    mde = 2.8 * sigma / (resid.std(ddof=1) * np.sqrt(len(rows)))
    print(f"  sessions whose worst file already scored 10.0 : {(severity < 0.005).mean():.0%}")
    print(f"  worst file health observed                    : {10 - severity.max():.2f}")
    print(f"  residual sd of severity after controls        : {resid.std(ddof=1):.3f}")
    print(f"  smallest detectable effect (80% power)        : {(np.exp(mde)-1)*100:+.0f}% per health point")


def block(rows, title):
    print(f"\n=== {title} (n={len(rows)}) ===")
    print("Effect of losing one Code Health point, controlling for LoC changed and file count:")
    report(rows, [r["output"] for r in rows], "output tokens")
    report(rows, [r["input"] + r["cache_write"] + r["cache_read"] for r in rows], "total tokens")
    report(rows, [r["n_commits"] for r in rows], "commits on branch")
    report(rows, [r["churn_commits"] for r in rows], "commit-level churn")

    y = np.log(np.array([r["output"] for r in rows], float) + 1)
    loc = np.log1p([r["loc_all"] for r in rows])
    beta, se, _ = fit(y, np.column_stack([np.ones(len(rows)), loc]))
    print(f"\nFor comparison, change size: doubling the diff costs "
          f"{(2 ** beta[1] - 1) * 100:+.0f}% output tokens (se {se[1]:.3f})")
    print("\nWhat the data can and cannot see:")
    power(rows)


def main():
    rows = json.load(open(PANEL))
    print(f"panel: {len(rows)} sessions, "
          f"{min(r['date'] for r in rows)} .. {max(r['date'] for r in rows)}")
    block(rows, "all sessions")
    block([r for r in rows if not r.get("smell_fix")],
          "excluding code-health-fix sessions -- the honest estimate")


if __name__ == "__main__":
    main()
