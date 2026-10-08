#!/usr/bin/env bash
# Build a clean, publishable copy of this repository.
#
#   bash .export/export.sh [OUT_DIR]        (default: /tmp/vershipgo-export)
#
# The source repository is NEVER modified: everything happens inside a fresh
# clone at OUT_DIR, which must not already exist. Nothing is pushed.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "$HERE/.." && pwd)"
OUT="${1:-/tmp/vershipgo-export}"

# shellcheck source=/dev/null
source "$HERE/config.env"

BRANCH="$EXPORT_SOURCE_BRANCH"
FILTER_REPO="${FILTER_REPO:-git-filter-repo}"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mFAIL: %s\033[0m\n' "$*" >&2; exit 1; }

[ -e "$OUT" ] && die "$OUT already exists. Remove it or pass another path."

# ---------------------------------------------------------------- 1. clone ---
say "Cloning $BRANCH into $OUT"
git clone --no-local --single-branch --branch "$BRANCH" "$SRC" "$OUT" --quiet
ORIGINAL_COUNT=$(git -C "$OUT" rev-list --count "$BRANCH")
git -C "$OUT" remote remove origin 2>/dev/null || true

# -------------------------------------------------- 2. unreferenced assets ---
# The reference implementation computed these from attached_assets/ against
# @assets/ imports. This repo has no attached_assets/ directory in any commit
# (verified), so there is nothing to compute and the path list is the static
# one. If an attached_assets/ tree is ever introduced, restore that step here.
PATHS_FILE="$OUT/.export-paths.txt"
grep -vE '^\s*(#|$)' "$HERE/private-paths.txt" > "$PATHS_FILE"

# git-filter-repo has NO comment syntax in its rule files: every non-empty line
# is a rule, so a bare "#" documentation line would be used as a literal search
# term and would replace every "#" in every blob with ***REMOVED***. Both rule
# files are therefore stripped of comments before being handed over.
BLOBS_FILE="$OUT/.export-blobs.txt"
grep -vE '^\s*(#|$)' "$HERE/blob-rewrites.txt" > "$BLOBS_FILE"

# ----------------------------------------------------------------- 3. fold ---
say "Folding boilerplate commits"
python3 "$HERE/fold-commits.py" \
  "$OUT" "$BRANCH" \
  "$EXPORT_DROP_SUBJECTS" "$EXPORT_DEPLOY_SUBJECTS" "$EXPORT_STRIP_TRAILERS" \
  "$EXPORT_AUTHOR_NAME" "$EXPORT_AUTHOR_EMAIL" \
  "$HERE/message-rewrites.txt"

# ---------------------------------------------------------- 4. filter-repo ---
if ! command -v "$FILTER_REPO" >/dev/null 2>&1; then
  say "git-filter-repo not found — fetching pinned v2.47.0"
  curl -fsSL -o "$OUT/.filter-repo.py" \
    https://raw.githubusercontent.com/newren/git-filter-repo/v2.47.0/git-filter-repo
  FILTER_REPO="python3 $OUT/.filter-repo.py"
fi

say "Stripping private paths and rewriting blob contents"
( cd "$OUT" && $FILTER_REPO --force \
    --invert-paths --paths-from-file "$PATHS_FILE" \
    --replace-text "$BLOBS_FILE" )

rm -f "$PATHS_FILE" "$BLOBS_FILE" "$OUT/.filter-repo.py"
git -C "$OUT" reflog expire --expire=now --all
git -C "$OUT" gc --prune=now --quiet

# ---------------------------------------------------------------- 5. verify ---
say "Verifying"
FAILED=0
fail() { printf '  \033[31m✗ %s\033[0m\n' "$*"; FAILED=1; }
pass() { printf '  \033[32m✓ %s\033[0m\n' "$*"; }

# 5a. exactly one identity, author and committer
IDENTS=$(git -C "$OUT" log --format='%an <%ae>|%cn <%ce>' | sort -u)
if [ "$(printf '%s\n' "$IDENTS" | wc -l)" -eq 1 ] && \
   [ "$IDENTS" = "$EXPORT_AUTHOR_NAME <$EXPORT_AUTHOR_EMAIL>|$EXPORT_AUTHOR_NAME <$EXPORT_AUTHOR_EMAIL>" ]; then
  pass "single identity: $EXPORT_AUTHOR_NAME <$EXPORT_AUTHOR_EMAIL>"
else
  fail "identities found:"; printf '      %s\n' "$IDENTS"
fi

# 5b. no commit message names an assistant or carries an attribution trailer
LEAK=$(git -C "$OUT" log --format=%B \
  | grep -inE 'claude|codex|co-authored-by|replit[ -]agent|\bagents?\b|anthropic|openai' || true)
if [ -z "$LEAK" ]; then pass "no assistant references in commit messages"
else fail "commit messages leak:"; printf '      %s\n' "$LEAK" | head -10; fi

# 5c. no private path is present in ANY commit (bare rules match the exact path
#     or a leading directory, which is filter-repo's own semantics)
ALLPATHS=$(git -C "$OUT" log --all --name-only --format= | sort -u | grep -v '^$' || true)
while IFS= read -r rule; do
  case "$rule" in
    ''|\#*) continue ;;
    regex:*) pat="${rule#regex:}"; hit=$(printf '%s\n' "$ALLPATHS" | grep -E "$pat" || true) ;;
    glob:*)  pat="${rule#glob:}";  hit=$(printf '%s\n' "$ALLPATHS" | grep -F "${pat##*/}" || true) ;;
    *)       bare="${rule%/}"
             hit=$(printf '%s\n' "$ALLPATHS" | grep -E "^${bare}(/|$)" || true) ;;
  esac
  [ -n "$hit" ] && { fail "private rule '$rule' still matches:"; printf '      %s\n' "$hit" | head -5; }
done < <(grep -vE '^\s*(#|$)' "$HERE/private-paths.txt")
[ "$FAILED" -eq 0 ] && pass "no private paths in any commit"

# 5d. FAIL on an authoring-session path baked into a source file. These are
#     unambiguous leaks (e.g. /tmp/claude-1000/<...>/scratchpad in the e2e
#     scripts) and a blob rewrite should have normalised them.
SESSION_LEAK=$(git -C "$OUT" grep -lE '/tmp/claude-[0-9]+|/\.claude/' -- . 2>/dev/null || true)
if [ -z "$SESSION_LEAK" ]; then pass "no authoring-session paths in tracked files"
else fail "session paths still in:"; printf '      %s\n' "$SESSION_LEAK" | head -10; fi

# 5e. warn only: assistant names inside HEAD file contents. Vendored third-party
#     assets are excluded: Remix Icon ships .ri-claude-* brand glyphs, which say
#     nothing about how this repo was built.
WARN=$(git -C "$OUT" grep -ilE 'claude|codex' -- \
        ':!*lock*' ':!*.svg' ':!*/vendor/*' ':!*.eot' ':!*.ttf' ':!*.woff*' 2>/dev/null || true)
[ -n "$WARN" ] && printf '  \033[33m! review (warning only): %s\033[0m\n' "$(echo "$WARN" | tr '\n' ' ')"

# 5f. optional build
if [ "${EXPORT_VERIFY_BUILD:-0}" = "1" ]; then
  say "Building the export"
  ( cd "$OUT/website" && corepack enable && pnpm install --ignore-workspace && pnpm run build ) \
    || fail "build failed"
fi

[ "$FAILED" -eq 0 ] || die "verification failed — fix the rule and re-run. Nothing was pushed."

# ---------------------------------------------------------------- 6. report ---
NEW_COUNT=$(git -C "$OUT" rev-list --count "$BRANCH")
say "Export complete"
cat <<EOF
  commits   $ORIGINAL_COUNT -> $NEW_COUNT
  first     $(git -C "$OUT" log --reverse --format='%h %ad %s' --date=short "$BRANCH" | head -1)
  last      $(git -C "$OUT" log -1 --format='%h %ad %s' --date=short "$BRANCH")
  .git size $(du -sh "$OUT/.git" | cut -f1)
  location  $OUT

Nothing has been pushed. To publish (only when you have been told to):
  git -C "$OUT" push --force <url> $BRANCH:main
EOF
