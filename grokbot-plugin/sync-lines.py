#!/usr/bin/env python3
"""Carry root SKILL.md edits into the grokbot-plugin split.

Diffs root SKILL.md between the blob in grokbot-plugin/SPLIT-BASE and the
working tree, then applies each replaced, inserted or deleted line to the
split file that holds the neighbouring text. With --apply it writes the
files and moves SPLIT-BASE to the current root SKILL.md. Anything it cannot
place is printed as UNPLACED for a human to put in the right mode skill.

usage: python3 grokbot-plugin/sync-lines.py [--apply]
"""
import os
os.chdir(__import__("subprocess").run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip())
import difflib, subprocess, sys, pathlib
base_blob = pathlib.Path("grokbot-plugin/SPLIT-BASE").read_text().strip()
old = subprocess.run(["git", "cat-file", "-p", base_blob], capture_output=True, text=True, check=True).stdout.split("\n")
new = pathlib.Path("SKILL.md").read_text().split("\n")
files = sorted(pathlib.Path("grokbot-plugin/skills").rglob("*.md"))
texts = {f: f.read_text().split("\n") for f in files}
apply = "--apply" in sys.argv
unplaced = []
def locate(line):
    return [(f, i) for f, ls in texts.items() for i, l in enumerate(ls) if l == line and line.strip()]
sm = difflib.SequenceMatcher(None, old, new, autojunk=False)
for op, i1, i2, j1, j2 in sm.get_opcodes():
    if op == "equal": continue
    olds, news = old[i1:i2], new[j1:j2]
    if op == "replace" and len(olds) == len(news):
        for o, n in zip(olds, news):
            if not o.strip() and not n.strip(): continue
            hits = locate(o)
            if not hits: unplaced.append(("replace", o[:90], n[:90])); continue
            for f, i in hits:
                print(f"REPLACE {f}:{i+1}\n  - {o[:110]}\n  + {n[:110]}"); texts[f][i] = n
    elif op == "insert" or (op == "replace" and len(olds) != len(news)):
        anchor = old[i1 - 1] if i1 > 0 else None
        for o in olds:
            for f, i in locate(o):
                print(f"DELETE {f}:{i+1} {o[:100]}"); texts[f][i] = None
        hits = locate(anchor) if anchor is not None else []
        if not hits: unplaced.append(("insert-after", (anchor or "")[:90], " | ".join(x[:60] for x in news))); continue
        f, i = hits[0]
        print(f"INSERT after {f}:{i+1} ({len(news)} lines): {' | '.join(x[:70] for x in news if x.strip())}")
        texts[f][i+1:i+1] = news
    elif op == "delete":
        for o in olds:
            for f, i in locate(o):
                print(f"DELETE {f}:{i+1} {o[:100]}"); texts[f][i] = None
if apply:
    for f, ls in texts.items():
        f.write_text("\n".join(l for l in ls if l is not None))
for u in unplaced: print("UNPLACED", u)
print(f"unplaced={len(unplaced)}")

if apply and not unplaced:
    blob = subprocess.run(["git", "hash-object", "-w", "SKILL.md"], capture_output=True, text=True, check=True).stdout.strip()
    pathlib.Path("grokbot-plugin/SPLIT-BASE").write_text(blob + "\n")
    print(f"SPLIT-BASE -> {blob}")
