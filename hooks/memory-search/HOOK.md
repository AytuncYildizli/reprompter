---
name: memory-search
description: "Proactive memory search - injects MANDATORY memory search instructions at session start"
metadata:
  {
    "openclaw":
      {
        "emoji": "🔗",
        "events": ["agent:bootstrap"],
      },
  }
---

# Memory Search Hook

Automatically injects MANDATORY memory search protocol into every new session.

## What It Does

1. Triggers on `agent:bootstrap` (new session start)
2. Injects memory search instructions into the agent's context
3. Agent follows these instructions for the ENTIRE session

## Injection Content

The hook adds a MEMORY_SEARCH_PROTOCOL to bootstrap files containing:

- **Trigger words** (TR + EN) that require memory search
- **Search command**: `~/clawd/scripts/whatsapp-memory/memory_skill.py --force "query"`
- **Response rules** based on confidence levels
- **NEVER/ALWAYS rules** to prevent hallucination

## Why This Works

The `agent:bootstrap` event fires once per session, but the injected instructions remain in the agent's context for ALL messages in that session. This means:

- Every message in the session has access to memory search instructions
- Agent is reminded to NEVER hallucinate past conversations
- Agent knows HOW to search (the exact command)
- Agent knows HOW to respond (based on confidence)

## Trigger Examples

User says any of these → Agent MUST search memory:
- "hatırlıyor musun" → Search before answering
- "dün ne konuştuk" → Search before answering
- "remember when we..." → Search before answering
- "what did we discuss" → Search before answering

## Testing

1. Start a new WhatsApp session or use `/new`
2. Ask "hatırlıyor musun dün ne konuştuk?"
3. Agent should run memory_skill.py and use results
4. NOT hallucinate past conversations
