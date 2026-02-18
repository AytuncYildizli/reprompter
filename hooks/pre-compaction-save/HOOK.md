---
name: pre-compaction-save
description: "Save critical context BEFORE compaction to prevent amnesia"
metadata:
  {
    "openclaw":
      {
        "emoji": "💾",
        "events": ["agent:bootstrap", "command:new"],
      },
  }
---

# Pre-Compaction Save Hook

This hook is part of the **Amnesia Prevention System** (Phase 2). It captures and saves critical context proactively, ensuring nothing important is lost when compaction occurs.

**Note**: OpenClaw's internal hook system does not fire `session:compacting` or `agent:memoryFlush` events for workspace hooks (those only exist in the extension API as `before_compaction`/`after_compaction`). As a workaround, this hook fires on `agent:bootstrap` and `command:new` to keep the snapshot always fresh.

## What It Does

1. Triggers on every session start (`agent:bootstrap`) and `/new` command (`command:new`)
2. Extracts critical information from the current conversation:
   - Active tasks and todos
   - Recent user decisions/confirmations
   - Conversation themes
   - Pending items
3. Reads existing `SESSION_STATE.md` for additional context
4. Saves everything to:
   - `memory/critical-context-snapshot.json` (latest snapshot)
   - `memory/critical-context.md` (human-readable)
   - `memory/daily-snapshots/{date}-snapshot.json` (historical archive)

## Why This Exists

The problem: When OpenClaw compacts a session, the agent loses conversational context. The existing `post-compaction-restore` hook can inject context AFTER compaction, but it depends on having context saved BEFORE.

This hook ensures that critical context is ALWAYS saved before any compaction event, providing the raw material for post-compaction restoration.

## Information Captured

### Active Tasks
- Extracted from SESSION_STATE.md (lines with `[ ]`)
- Any pending todos mentioned in conversation

### Recent Decisions
- User confirmations detected via keywords: "tamam", "aynen", "kalsın", "let's go with"
- Captures what the assistant proposed that the user agreed to

### Conversation Themes
Automatically detected themes:
- memory-system, compaction, whatsapp, development, flight, email, cost-optimization

### Message Summary
- Last 5 messages condensed for quick context restoration

## Configuration

No configuration needed. Works automatically when enabled.

## Files Created

| File | Purpose |
|------|---------|
| `memory/critical-context-snapshot.json` | Latest snapshot (JSON) |
| `memory/critical-context.md` | Human-readable snapshot |
| `memory/daily-snapshots/{date}-snapshot.json` | Daily archive (keeps last 20) |

## Integration with Post-Compaction Restore

The `post-compaction-restore` hook reads from these files to inject context after compaction. Together they form a complete amnesia prevention pipeline:

1. **Pre-compaction**: Save everything important
2. **Compaction**: Tokens reduced
3. **Post-compaction**: Inject saved context back into bootstrap
