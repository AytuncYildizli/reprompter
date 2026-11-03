#!/usr/bin/env python3
"""Carry root SKILL.md edits into the grokbot-plugin split.

Diffs root SKILL.md between the blob in grokbot-plugin/SPLIT-BASE and the
working tree, then applies each replaced, inserted or deleted line to the
split file that holds it. New lines go after the nearest preceding root line
that appears exactly once in the split bodies, never inside YAML frontmatter.
Anything it cannot place is printed as UNPLACED for a human to put in the
right mode skill. --apply is all or nothing: it writes the files and moves
SPLIT-BASE only when every change was placed.

usage: python3 grokbot-plugin/sync-lines.py [--apply]
"""
import difflib
import os
import pathlib
import subprocess
import sys

os.chdir(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip())

base_blob = pathlib.Path("grokbot-plugin/SPLIT-BASE").read_text().strip()
old = subprocess.run(["git", "cat-file", "-p", base_blob], capture_output=True, text=True, check=True).stdout.split("\n")
new = pathlib.Path("SKILL.md").read_text().split("\n")
texts = {f: f.read_text().split("\n") for f in sorted(pathlib.Path("grokbot-plugin/skills").rglob("*.md"))}
apply = "--apply" in sys.argv
unplaced = []


def frontmatter_end(lines):
    if not lines or lines[0] != "---":
        return -1
    return next((i for i in range(1, len(lines)) if lines[i] == "---"), -1)


def locate(line, body_only=False):
    hits = []
    for f, lines in texts.items():
        fm = frontmatter_end(lines) if body_only else -1
        hits += [(f, i) for i, l in enumerate(lines) if i > fm and l == line and line.strip()]
    return hits


def insertion_point(i1):
    """Position after the nearest preceding root line that is unique in the split bodies."""
    for k in range(i1 - 1, -1, -1):
        cand = old[k].strip()
        if len(cand) < 4 or cand == "---":
            continue
        hits = locate(old[k], body_only=True)
        if len(hits) != 1:
            continue
        f, p = hits[0]
        lines = texts[f]
        for j in range(k + 1, i1):
            if p + 1 < len(lines) and lines[p + 1] == old[j]:
                p += 1
            else:
                break
        return f, p
    return None


for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes():
    if op == "equal":
        continue
    olds, news = old[i1:i2], new[j1:j2]
    if op == "replace" and len(olds) == len(news):
        for o, n in zip(olds, news):
            if not o.strip() and not n.strip():
                continue
            hits = locate(o)
            if not hits:
                unplaced.append(("replace", o[:90], n[:90]))
                continue
            for f, i in hits:
                print(f"REPLACE {f}:{i + 1}\n  - {o[:110]}\n  + {n[:110]}")
                texts[f][i] = n
        continue
    for o in olds:
        for f, i in locate(o):
            print(f"DELETE {f}:{i + 1} {o[:100]}")
            texts[f][i] = None
    if op == "delete":
        continue
    at = insertion_point(i1)
    if at is None:
        unplaced.append(("insert", " | ".join(x[:60] for x in news if x.strip())))
        continue
    f, p = at
    print(f"INSERT after {f}:{p + 1} ({len(news)} lines): {' | '.join(x[:70] for x in news if x.strip())}")
    texts[f][p + 1:p + 1] = news

for u in unplaced:
    print("UNPLACED", u)
print(f"unplaced={len(unplaced)}")

if apply and unplaced:
    print("Nothing written: place the UNPLACED lines by hand, or fix them at root, then rerun.")
elif apply:
    for f, lines in texts.items():
        f.write_text("\n".join(l for l in lines if l is not None))
    blob = subprocess.run(["git", "hash-object", "-w", "SKILL.md"], capture_output=True, text=True, check=True).stdout.strip()
    pathlib.Path("grokbot-plugin/SPLIT-BASE").write_text(blob + "\n")
    print(f"SPLIT-BASE -> {blob}")
