---
name: post-compaction-restore
description: "Restore context after compaction by injecting SESSION_STATE.md and recent archive into bootstrap"
metadata:
  {
    "openclaw":
      {
        "emoji": "🔄",
        "events": ["agent:bootstrap"],
      },
  }
---

# Post-Compaction Context Restore

This hook ensures the agent recovers context after token compaction by modifying the bootstrap files injection.

## What It Does

1. Checks if the session has been compacted (compaction count > 0)
2. If compacted, adds a reminder to the bootstrap context to read SESSION_STATE.md
3. Optionally injects the most recent archive from `remember-all-prompts-daily.md`

## Why This Exists

When Clawdbot compacts a session to free up token space, the agent loses conversational context. 
The default `memoryFlush` saves notes BEFORE compaction, but nothing reminds the agent to READ 
those notes after the new context starts.

This hook bridges that gap by injecting a reminder into the bootstrap phase.

## Configuration

No configuration needed. Works automatically when enabled.

## Requirements

- `SESSION_STATE.md` should exist in the workspace
- Agent should maintain `SESSION_STATE.md` during `memoryFlush` phase
