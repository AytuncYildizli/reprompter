---
name: norget-trigger
description: "Norget bookmark keeper - detects bookmark commands and injects context"
metadata:
  {
    "openclaw":
      {
        "emoji": "📎",
        "events": ["agent:bootstrap"],
      },
  }
---

# Norget Trigger Hook

Automatically injects bookmark keeper context when the user sends bookmark-related commands.

## What It Does

1. Triggers on `agent:bootstrap` (new session/message)
2. Checks if the message contains bookmark trigger words
3. If yes, injects NORGET_CONTEXT into bootstrap files

## Trigger Keywords

- bm, bookmark, yer imi, kaydet (+ URL pattern)
- norget, bookmarklarım, kaydettiklerim

## Integration

The hook provides context so Mahmut knows:
- The norget.sh bash wrapper exists at `~/clawd/scripts/norget/norget.sh`
- How to save, search, list, and manage bookmarks

## Testing

1. WhatsApp'tan "bm https://example.com" yaz
2. Mahmut norget context alır ve `norget.sh save` çalıştırır
3. Sonucu WhatsApp'tan gönderir
