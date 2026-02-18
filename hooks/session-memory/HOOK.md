# Session Memory Hook

Tracks last 30 messages in `memory/last-messages.json`.
Used by pre-compaction-save and post-compaction-restore for amnesia prevention.

## Hook Type
`agent:bootstrap` + `agent:message`
