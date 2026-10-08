#!/usr/bin/env python3
"""Rebuild a branch's history with boilerplate commits folded away.

    fold-commits.py <repo> <branch> <drop-re> <deploy-re> <trailer-re> \
                    <name> <email> <message-rewrites>

The method is snapshot-based, not diff-based: every kept commit is recreated
with `git commit-tree <ITS OWN ORIGINAL TREE> -p <previous kept commit>`. Because
no diff is ever replayed, dropping a commit automatically folds its changes
forward into the next kept commit and no conflict is possible.

Two rules keep the ends of history honest:

  * backward fold - a run of dropped commits that ends at a deploy marker or at
    the end of history hands its final tree to the PRECEDING kept commit, so a
    release marker stays empty and the branch tip never loses work.
  * the first commit may not be a drop candidate (there is no preceding commit
    to fold into), and the script refuses rather than guess.

Determinism: the original author date is used as BOTH the author and committer
date, so re-running against the same input reproduces the same commit hashes.
"""

import os
import re
import subprocess
import sys

# ASCII unit/record separators: safe inside a --format argv (a NUL is not) and
# vanishingly unlikely to appear in a commit message.
SEP = "\x1f"
REC = "\x1e\n"


def git(repo, *args, **kw):
    return subprocess.run(
        ["git", "-C", repo, *args],
        check=True, capture_output=True, text=True, **kw
    ).stdout


def load_rewrites(path):
    """Parse message-rewrites.txt into (compiled-or-literal, replacement) pairs."""
    rules = []
    if not path or not os.path.exists(path):
        return rules
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.rstrip("\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            pattern, _, replacement = line.partition("==>")
            replacement = replacement.replace("\\n", "\n")
            if pattern.startswith("regex:"):
                rules.append((re.compile(pattern[6:]), replacement))
            else:
                rules.append((pattern, replacement))
    return rules


def clean_message(msg, trailer_re, rules):
    """Strip configured trailers, apply rewrites, normalise blank lines."""
    if trailer_re:
        msg = re.sub(
            r"(?im)^\s*(?:%s)\s*:[^\n]*\n?" % trailer_re, "", msg
        )
    for pattern, replacement in rules:
        if isinstance(pattern, str):
            msg = msg.replace(pattern, replacement)
        else:
            msg = pattern.sub(replacement, msg)
    msg = re.sub(r"\n{3,}", "\n\n", msg).strip()
    return msg + "\n"


def main():
    if len(sys.argv) != 9:
        sys.exit(__doc__)

    (repo, branch, drop_re, deploy_re, trailer_re,
     name, email, rewrites_path) = sys.argv[1:]

    drop = re.compile(drop_re) if drop_re else None
    deploy = re.compile(deploy_re) if deploy_re else None
    rules = load_rewrites(rewrites_path)

    # --first-parent flattens the one PR merge on this branch: a merge commit's
    # tree is already the fully merged snapshot, so it rebuilds as an ordinary
    # commit with nothing lost. Walking without it would interleave both sides
    # of the merge by date and scramble the order.
    fmt = SEP.join(["%H", "%P", "%T", "%aI", "%B"]) + REC
    log = git(repo, "log", "--reverse", "--first-parent",
              "--format=" + fmt, branch)

    commits = []
    for record in log.split(REC):
        if not record.strip():
            continue
        sha, parents, tree, adate, body = record.split(SEP, 4)
        commits.append({
            "sha": sha.lstrip("\n"),
            "parents": parents.split(),
            "tree": tree,
            "date": adate,
            "body": body,
            "subject": body.splitlines()[0] if body.strip() else "",
        })

    if not commits:
        sys.exit("fold-commits: no commits on %s" % branch)

    # Classify. D = dropped, P = deploy marker (kept, forced empty), K = kept.
    for c in commits:
        if drop and drop.search(c["subject"]):
            c["cls"] = "D"
        elif deploy and deploy.search(c["subject"]):
            c["cls"] = "P"
        else:
            c["cls"] = "K"

    if commits[0]["cls"] == "D":
        sys.exit(
            "fold-commits: the first commit (%s %r) is a drop candidate; there "
            "is nothing to fold it into. Narrow EXPORT_DROP_SUBJECTS."
            % (commits[0]["sha"][:9], commits[0]["subject"])
        )

    # Backward fold: a run of dropped commits ending at a deploy marker or at
    # the end of history gives its final tree to the preceding kept commit.
    folds = 0
    for i, c in enumerate(commits):
        if c["cls"] != "D":
            continue
        j = i
        while j + 1 < len(commits) and commits[j + 1]["cls"] == "D":
            j += 1
        ends_history = j + 1 == len(commits)
        ends_at_marker = not ends_history and commits[j + 1]["cls"] == "P"
        if not (ends_history or ends_at_marker):
            continue
        for k in range(i - 1, -1, -1):
            if commits[k]["cls"] != "D":
                commits[k]["tree"] = commits[j]["tree"]
                folds += 1
                break

    env = dict(os.environ)
    env.update({
        "GIT_AUTHOR_NAME": name, "GIT_AUTHOR_EMAIL": email,
        "GIT_COMMITTER_NAME": name, "GIT_COMMITTER_EMAIL": email,
    })

    kept = dropped = 0
    parent = None
    for c in commits:
        if c["cls"] == "D":
            dropped += 1
            continue

        tree = c["tree"]
        if c["cls"] == "P" and parent is not None:
            # A deploy marker carries no changes of its own.
            tree = git(repo, "rev-parse", parent + "^{tree}").strip()

        args = ["commit-tree", tree]
        if parent:
            args += ["-p", parent]

        env["GIT_AUTHOR_DATE"] = c["date"]
        env["GIT_COMMITTER_DATE"] = c["date"]   # determinism

        parent = subprocess.run(
            ["git", "-C", repo, *args],
            input=clean_message(c["body"], trailer_re, rules),
            check=True, capture_output=True, text=True, env=env,
        ).stdout.strip()
        kept += 1

    git(repo, "update-ref", "refs/heads/" + branch, parent)
    git(repo, "checkout", "-f", branch)

    print("fold-commits: kept %d, dropped %d, backward folds %d  (tip %s)"
          % (kept, dropped, folds, parent[:9]))


if __name__ == "__main__":
    main()
