# `.export/` — clean repository export

Builds a separate, publishable copy of this repository: the real development
history, with the private and machine-generated layers removed from **every**
commit rather than only from `HEAD`.

The source repo is never modified. Nothing is ever pushed by `export.sh`.

## Run it

```bash
bash .export/export.sh                 # -> /tmp/vershipgo-export
bash .export/export.sh /tmp/somewhere  # OUT_DIR must not already exist
```

`EXPORT_VERIFY_BUILD=1` in `config.env` adds a `pnpm install && pnpm run build`
check at the end.

## Files

| File | Purpose |
|---|---|
| `config.env` | Author identity, branch, drop/deploy subject regexes, trailer-key regex |
| `private-paths.txt` | Paths removed from all history (`git filter-repo --paths-from-file` syntax) |
| `message-rewrites.txt` | Ordered commit-message rewrites, with case-insensitive body-line safety nets |
| `blob-rewrites.txt` | File-content rewrites across all history (`--replace-text`) |
| `fold-commits.py` | Rebuilds the branch, folding boilerplate commits away |
| `export.sh` | Clone → fold → filter → verify → report |

`.export/` and `.github/workflows/export-clean.yml` list **themselves** in
`private-paths.txt`, so the export never ships its own machinery.

## How the folding works

Every kept commit is recreated with `git commit-tree <ITS OWN ORIGINAL TREE> -p
<previous kept commit>`. Nothing is diffed or replayed, so dropping a commit
folds its changes forward into the next kept commit and a conflict is
impossible.

Two edge rules:

- **Backward fold** — a run of dropped commits ending at a deploy marker or at
  the end of history hands its final tree to the *preceding* kept commit. This
  keeps release markers empty and stops the branch tip losing work. It matters
  here because `HEAD` is a dropped `Published your App` commit.
- **First commit** — may not be a drop candidate; there is nothing to fold it
  into, so the script refuses rather than guess.

Determinism comes from reusing each commit's original author date as **both**
the author and committer date. Two runs produce identical hashes, which is what
makes the force-push in CI safe.

### Merges

`fold-commits.py` walks `--first-parent`. A merge commit's tree is already the
fully merged snapshot, so it rebuilds as an ordinary commit with nothing lost.
This branch has one merge (PR #1, `feat/ux-a11y-seo-security`); its five branch
commits collapse into it and read as a single change.

Walking *without* `--first-parent` would interleave both sides of a merge by
date and scramble the rebuilt order — that is what the reference method's
"refuse merge commits" rule exists to prevent.

## What gets removed

- **Identity** — 21 commits authored by `Replit Agent <agent@replit.com>` become
  the configured human identity, author and committer.
- **Trailers** — `Co-Authored-By` (33), `Claude-Session` (19),
  `Replit-Commit-Author` (20) and five `Replit-*` keys that appear exactly once
  each. Stripping is key-regex based for that reason; a hand-written list drawn
  from a sample would have missed them.
- **Commits** — 15 `Published your App` deploy/checkpoint commits. Their file
  changes survive via the fold.
- **Paths** — `replit.md`, `CHECKOUT_PAYOUTS_PLAN.md`, `tools/claude/`, plus
  rules for records that are gitignored today but would be caught if they were
  ever committed.
- **Contents** — the `.gitignore` block naming the assistant artefacts it
  ignores; an internal package-mirror URL, should one reappear in a lockfile.

Deliberately **kept**, with reasons recorded in `private-paths.txt`:
`RENDER_MIGRATION.md`, `e2e/`, `server/tests/`, `artifacts/`, `lib/`, `scripts/`,
and the platform run files (`.replit`, `render.yaml`) so the clean repo still
runs.

## When verification fails

`export.sh` exits non-zero and names what leaked. Add a rule to the matching
file and re-run — the rule files are data, so a new leak is a new line, never a
code change.

| Leak | File to edit |
|---|---|
| A path that should not be published | `private-paths.txt` |
| Text in a commit message | `message-rewrites.txt` |
| Text inside a file | `blob-rewrites.txt` |
| An identity or a boilerplate subject | `config.env` |

## Publishing

Only on explicit instruction, and only to a repository URL you have been given.

```bash
bash .export/export.sh /tmp/x
git -C /tmp/x push --force <url> render-migration:main
```

CI does the same on every push to `render-migration`
(`.github/workflows/export-clean.yml`). One-time setup on this repo:

- Actions **variable** `CLEAN_REPO` — `owner/name` of the clean repo
- Actions **secret** `CLEAN_REPO_TOKEN` — fine-grained PAT scoped to that repo
  only, Contents: read and write
