#!/usr/bin/env python3
"""Rank open GitHub issues by impact/effort score."""

import json
import re
import subprocess
import sys


PRIORITY_RANK = {"high": 3, "medium": 2, "low": 1}
DIFFICULTY_RANK = {"trivial": 3, "moderate": 2, "difficult": 1}


def fetch_issues(milestone_keywords=None):
    """Fetch open issues, optionally filtered by milestone keywords.

    Args:
        milestone_keywords: List of words that must all appear (case-
            insensitive) in the milestone title. Issues without a
            milestone are excluded when keywords are provided.
    """
    cmd = [
        "gh", "issue", "list", "--state", "open", "--limit", "200",
        "--json", "number,title,labels,body,assignees,milestone",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    issues = json.loads(result.stdout)

    if not milestone_keywords:
        return issues

    keywords_lower = [w.lower() for w in milestone_keywords]
    filtered = []
    for issue in issues:
        ms = issue.get("milestone")
        if not ms or not ms.get("title"):
            continue
        title_lower = ms["title"].lower()
        if all(kw in title_lower for kw in keywords_lower):
            filtered.append(issue)
    return filtered


def extract_labels(issue):
    priority = None
    difficulty = None
    for label in issue.get("labels", []):
        name = label["name"]
        if name in PRIORITY_RANK:
            priority = name
        if name in DIFFICULTY_RANK:
            difficulty = name
    return priority, difficulty


def find_dependencies(body, open_numbers):
    """Extract dependency issue numbers from the body text.

    Detects two patterns:
    1. Inline: "depends on #123", "blocked by #456", "requires #789"
    2. Section: a "### Dependencies" header followed by lines like "- #123 ..."
    """
    if not body:
        return []
    refs = set()

    # Pattern 1: inline dependency keywords
    inline = r"(?:depends on|blocked by|requires|after)[:\s*]*#(\d+)"
    refs.update(int(m) for m in re.findall(inline, body, re.IGNORECASE))

    # Pattern 2: "### Dependencies" section — collect #N from subsequent lines
    section = re.search(
        r"^#{1,3}\s*dependenc(?:y|ies)\s*\n(.*?)(?=\n#{1,3}\s|\Z)",
        body,
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    if section:
        for m in re.findall(r"#(\d+)", section.group(1)):
            refs.add(int(m))

    return [n for n in refs if n in open_numbers]


def rank_issues(milestone_keywords=None):
    """Rank issues, optionally filtered by milestone keywords.

    Args:
        milestone_keywords: List of words that must all appear (case-
            insensitive) in the milestone title.
    """
    issues = fetch_issues(milestone_keywords)
    open_numbers = {i["number"] for i in issues}

    scored = []
    blocked_list = []

    # Build dependency map: which issues does each issue unblock?
    unblocks_map = {}  # issue_number -> list of issues it unblocks
    dep_map = {}  # issue_number -> list of open deps

    for issue in issues:
        deps = find_dependencies(issue.get("body", ""), open_numbers)
        dep_map[issue["number"]] = deps
        for dep in deps:
            unblocks_map.setdefault(dep, []).append(issue["number"])

    for issue in issues:
        num = issue["number"]
        title = issue["title"]
        priority, difficulty = extract_labels(issue)
        p_rank = PRIORITY_RANK.get(priority, 0)
        d_rank = DIFFICULTY_RANK.get(difficulty, 0)
        unblocks_count = len(unblocks_map.get(num, []))
        deps = dep_map[num]

        entry = {
            "number": num,
            "title": title,
            "priority": priority or "unlabeled",
            "difficulty": difficulty or "unlabeled",
            "_p_rank": p_rank,
            "_d_rank": d_rank,
            "unblocks": unblocks_count,
            "blocked_by": deps,
        }

        if deps:
            blocked_list.append(entry)
        else:
            scored.append(entry)

    # Sort: priority tier first, then difficulty within tier, then unblocks, then number
    scored.sort(key=lambda x: (
        -x["_p_rank"],
        -x["_d_rank"],
        -x["unblocks"],
        x["number"],
    ))
    blocked_list.sort(key=lambda x: x["number"])

    for entry in scored + blocked_list:
        entry.pop("_p_rank", None)
        entry.pop("_d_rank", None)

    output = {"ranked": scored, "blocked": blocked_list}
    if milestone_keywords:
        output["milestone_filter"] = " ".join(milestone_keywords)
    json.dump(output, sys.stdout, indent=2)


if __name__ == "__main__":
    keywords = sys.argv[1:] if len(sys.argv) > 1 else None
    rank_issues(keywords)
