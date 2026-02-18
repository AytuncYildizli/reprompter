---
name: bootstrap-context
description: "Automatically injects relevant context at session start"
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "events": ["agent:bootstrap"],
      },
  }
---

# Bootstrap Context Hook

## Purpose
Automatically injects relevant context at session start without being asked.

## Trigger
- Event: `agent:bootstrap`
- Timing: Every session start

## What It Does
1. Reads today's and yesterday's daily notes
2. Extracts highlights, decisions, pending tasks
3. Identifies active projects
4. Formats and injects as SESSION_CONTEXT

## Context Includes
- Recent activity from daily notes
- Active projects detected from mentions
- Pending tasks ([ ] items)
- Recent decisions

## Configuration
Currently always runs. To make it conditional:
- Check `event.context?.sessionEntry?.channel` for channel-specific injection
- Check compactionCount to only inject after compaction

## Integration
Add to `~/.openclaw/openclaw.json`:
```json
{
  "hooks": {
    "internal": {
      "load": {
        "extraDirs": [
          "/Users/aytuncyildizli/clawd/scripts/whatsapp-memory/hooks/bootstrap-context"
        ]
      }
    }
  }
}
```
