---
name: finance-trigger
description: "Finance context injection - detects money/spending topics and injects finance assistant tools"
metadata:
  {
    "openclaw":
      {
        "emoji": "💰",
        "events": ["agent:bootstrap"],
      },
  }
---

# Finance Trigger Hook

Automatically injects finance assistant context when the user talks about money, spending, or payments.

## What It Does

1. Triggers on `agent:bootstrap` (new session/message)
2. Checks if the message contains finance-related keywords (TR + EN)
3. If yes, injects FINANCE_CONTEXT into bootstrap files with:
   - Available finance commands
   - How to parse manual transactions
   - How to generate reports

## Trigger Keywords (Turkish + English)

- harcama, gider, harcadim, odedim, fatura, kira, abonelik, butce
- market, yemek, benzin, akaryakit, taksit, ekstre
- ne kadar harcadim, aylik rapor, haftalik ozet
- spending, expense, payment, bill, subscription, budget

## Integration

The hook provides context so Mahmut knows:
- The finance.sh bash wrapper exists at `~/clawd/scripts/finance/finance.sh`
- How to add manual transactions
- How to generate reports
- How to check reminders and subscriptions

## Testing

1. WhatsApp'tan "bu ay ne kadar harcadim?" yaz
2. Mahmut finance context alir ve `finance.sh summary` calistirir
3. Sonucu WhatsApp'tan gonderir
