#!/usr/bin/env python3
"""Carry root SKILL.md edits into the grokbot-plugin split, or say why not.

Diffs root SKILL.md between the blob in grokbot-plugin/SPLIT-BASE and the
working tree, and applies only edits it can place without guessing:

- A changed or deleted line is edited where the split holds a copy whose
  nearest non-blank neighbours match the root's, and only if root itself
  has that line with those neighbours once. The split repeats some lines
  (headings in several mode skills, a fenced copy of the frontmatter), so a
  bare text match is not enough.
- New lines go after a root body line that has exactly one such copy outside
  frontmatter and code fences.

Two edits aimed at one split line, new text with a relative link or path that
would need rewriting for the split, and everything else, are UNPLACED. Copies
of root reference and script files are left to sync-copies.sh. After --apply
the tool runs verify-split.sh against the old SPLIT-BASE and restores every
file if it fails, so an old line left in any copy undoes the sync. --apply is all or nothing: with any
UNPLACED edit it writes no file, leaves SPLIT-BASE alone and exits 1.

usage: python3 grokbot-plugin/sync-lines.py [--apply]
"""
import difflib
import os
import pathlib
import subprocess
import sys

os.chdir(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip())

base_blob = pathlib.Path("grokbot-plugin/SPLIT-BASE").read_text().strip()
if subprocess.run(["git", "cat-file", "-e", base_blob], capture_output=True).returncode != 0:
    sys.exit(f"SPLIT-BASE blob {base_blob} is not in this clone. Fetch full history (git fetch --unshallow) and rerun.")
old = subprocess.run(["git", "cat-file", "-p", base_blob], capture_output=True, text=True, check=True).stdout.split("\n")
new = pathlib.Path("SKILL.md").read_text().split("\n")
import re


def owned_by_copies(f):
    """A references/ or scripts/ file with a root counterpart belongs to sync-copies.sh."""
    rel = pathlib.Path(*f.parts[3:])
    return rel.parts[0] in ("references", "scripts") and rel.exists()


texts = {f: f.read_text().split("\n") for f in sorted(pathlib.Path("grokbot-plugin/skills").rglob("*.md")) if not owned_by_copies(f)}
originals = {f: f.read_text() for f in texts}
RELATIVE_PATH = re.compile(r"\]\((?!https?:|mailto:|#)[^)]+\)|`(?:\.\./|references/)[^`]*`")
apply = "--apply" in sys.argv
root_body_start = [i for i, line in enumerate(old) if line == "---"][1] + 1


def sheltered(lines):
    """Indices inside YAML frontmatter or a fenced code block."""
    out, fence = set(), False
    if lines and lines[0] == "---":
        end = next((i for i in range(1, len(lines)) if lines[i] == "---"), len(lines) - 1)
        out.update(range(end + 1))
    for i, line in enumerate(lines):
        if line.startswith("```"):
            fence = not fence
            out.add(i)
        elif fence:
            out.add(i)
    return out


shelter = {f: sheltered(lines) for f, lines in texts.items()}


def neighbour(lines, i, step):
    j = i + step
    while 0 <= j < len(lines):
        if lines[j].strip():
            return lines[j]
        j += step
    return None


def context(lines, i):
    return lines[i], neighbour(lines, i, -1), neighbour(lines, i, 1)


root_contexts = {}
for _k in range(len(old)):
    root_contexts.setdefault(context(old, _k), []).append(_k)


def copies_of(k):
    """Split copies of root line k whose nearest non-blank neighbours match the root's.

    Empty when root itself repeats that line with the same neighbours, because
    then no split copy can be tied to this occurrence.
    """
    if len(root_contexts[context(old, k)]) > 1:
        return []
    line, before, after = context(old, k)
    return [
        (f, i)
        for f, lines in texts.items()
        for i, text in enumerate(lines)
        if text == line and line.strip() and neighbour(lines, i, -1) == before and neighbour(lines, i, 1) == after
    ]


def slot_for_insert(i1):
    """(file, index to insert at) after the nearest unique, unsheltered root body anchor."""
    for k in range(i1 - 1, root_body_start - 1, -1):
        if len(old[k].strip()) < 4 or old[k].strip() == "---":
            continue
        hits = [(f, i) for f, i in copies_of(k) if i not in shelter[f]]
        if len(hits) != 1:
            return None
        f, p = hits[0]
        for j in range(k + 1, i1):
            if p + 1 < len(texts[f]) and texts[f][p + 1] == old[j]:
                p += 1
            else:
                return None
        return f, p + 1
    return None


edits, unplaced = [], []  # edits: (file, index, kind, payload)
for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes():
    if op == "equal":
        continue
    olds, news = old[i1:i2], new[j1:j2]
    if op == "replace" and len(olds) == len(news):
        for k, replacement in zip(range(i1, i2), news):
            if not old[k].strip() and not replacement.strip():
                continue
            hits = copies_of(k)
            if not hits:
                unplaced.append(f"change: {old[k][:70]!r} -> {replacement[:70]!r}")
            edits += [(f, i, "set", replacement) for f, i in hits]
        continue
    for k in range(i1, i2):
        if not old[k].strip():
            continue
        hits = copies_of(k)
        if not hits:
            unplaced.append(f"delete: {old[k][:90]!r}")
        edits += [(f, i, "delete", None) for f, i in hits]
    if op == "delete":
        continue
    slot = slot_for_insert(i1)
    if slot is None:
        unplaced.append("insert: " + " | ".join(x[:60] for x in news if x.strip()))
        continue
    edits.append((slot[0], slot[1], "insert", news))

targets = {}
for f, i, kind, _ in edits:
    targets.setdefault((f, i, kind == "insert"), []).append(kind)
for (f, i, _), kinds in targets.items():
    if len(kinds) > 1:
        unplaced.append(f"collision: {len(kinds)} edits target {f}:{i + 1}")

for f, i, kind, payload in edits:
    for line in [payload] if isinstance(payload, str) else (payload or []):
        if RELATIVE_PATH.search(line):
            unplaced.append(f"relative path needs rewriting for the split: {line[:80]!r}")

for f, i, kind, payload in edits:
    shown = payload if isinstance(payload, str) else " | ".join(x[:60] for x in (payload or []) if x.strip())
    print(f"{kind.upper():6} {f}:{i + 1} {shown[:110]}")
for u in unplaced:
    print("UNPLACED", u)
print(f"edits={len(edits)} unplaced={len(unplaced)}")

if unplaced:
    if apply:
        print("Nothing written. Place the UNPLACED lines by hand, then move SPLIT-BASE to `git hash-object SKILL.md`.")
    sys.exit(1)
if apply:
    for f in texts:
        lines = list(texts[f])
        for _, i, kind, payload in sorted((e for e in edits if e[0] == f), key=lambda e: e[1], reverse=True):
            if kind == "set":
                lines[i] = payload
            elif kind == "delete":
                del lines[i]
            else:
                lines[i:i] = payload
        f.write_text("\n".join(lines))
    # Verify against the old base first: its stale check is what finds an old
    # line left behind in a copy the sync could not tie to the root edit.
    check = subprocess.run(["bash", "grokbot-plugin/verify-split.sh"], capture_output=True, text=True)
    if check.returncode != 0:
        for f, text in originals.items():
            f.write_text(text)
        summary = [l for l in check.stdout.splitlines() if l.startswith(("SUMMARY", "STALE", "MISSING"))]
        sys.exit("verify-split.sh failed after the sync, so every file was restored.\n" + "\n".join(summary[:12]))
    blob = subprocess.run(["git", "hash-object", "-w", "SKILL.md"], capture_output=True, text=True, check=True).stdout.strip()
    pathlib.Path("grokbot-plugin/SPLIT-BASE").write_text(blob + "\n")
    print(f"SPLIT-BASE -> {blob}")
