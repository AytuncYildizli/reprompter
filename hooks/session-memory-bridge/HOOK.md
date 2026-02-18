---
name: session-memory-bridge
description: "Cross-session context persistence and automatic handoff between sessions"
metadata:
  {
    "openclaw":
      {
        "emoji": "🌉",
        "events": ["agent:bootstrap", "session:end", "agent:memoryFlush", "session:save"],
      },
  }
---

# Session Memory Bridge Hook

Part of the **Amnesia Prevention System** (Phase 2). Enables seamless context transfer between different sessions, ensuring continuity even when starting fresh.

## What It Does

### On Session Start (`agent:bootstrap`)
1. Reads cross-session memory from previous sessions
2. Identifies the most recent previous session
3. Injects relevant context:
   - Previous session themes
   - Persistent important facts
   - Pending items that carry over
4. Logs the handoff for auditing

### On Session End (`session:end`)
1. Extracts conversation themes
2. Updates session record with end time
3. Saves to cross-session memory for next session

### During Session (`agent:memoryFlush`, `session:save`)
1. Periodic updates to cross-session memory
2. Ensures context is captured even if session ends unexpectedly

## Files Created

| File | Purpose |
|------|---------|
| `memory/session-bridge/cross-session-memory.json` | Persistent cross-session state |
| `memory/session-bridge/handoff-log.jsonl` | Audit log of all session handoffs |

## Cross-Session Memory Structure

```json
{
  "lastUpdated": "2026-02-01T10:00:00Z",
  "recentSessions": [
    {
      "sessionKey": "whatsapp-+905395815698",
      "startedAt": "2026-02-01T08:00:00Z",
      "endedAt": "2026-02-01T10:00:00Z",
      "themes": ["memory", "development"],
      "messageCount": 45
    }
  ],
  "persistentContext": {
    "userPreferences": {
      "language": "tr-en-mixed",
      "timezone": "Asia/Singapore"
    },
    "recurringTopics": ["memory", "whatsapp", "development"],
    "importantFacts": ["Flight on Feb 2 at 11:40 SGT"],
    "pendingItems": ["Check flight status"]
  },
  "handoffHistory": [...]
}
```

## Theme Detection

Automatically detects these conversation themes:
- `memory` - Memory system, context, compaction
- `development` - Code, API, config, bugs
- `travel` - Flights, hotels, bookings
- `email` - Email, inbox management
- `whatsapp` - Messaging, chat
- `finance` - Costs, payments
- `home-automation` - Smart home, lights

## Configuration

No configuration needed. Works automatically when enabled.

## Integration

Works with other amnesia prevention hooks:
1. **pre-compaction-save**: Saves detailed context before compaction
2. **post-compaction-restore**: Restores context after compaction
3. **session-memory-bridge**: Transfers context between sessions
4. **memory-search**: Enables searching older memories
