---
name: self-improvement-gateway
description: "Auto-logs gateway errors and significant events to .learnings/"
metadata:
  {
    "openclaw":
      {
        "emoji": "📚",
        "events": ["message:error", "agent:error", "tool:error"],
      },
  }
---

# Self-Improvement Gateway Hook

Automatically captures errors from the OpenClaw gateway and logs them to `.learnings/ERRORS.md` for later analysis.

## What It Captures

- Gateway startup failures
- WhatsApp connection errors
- Tool execution failures
- API/auth errors
- Cron job failures

## Integration

This hook runs on error events and appends structured entries to the learnings log.
